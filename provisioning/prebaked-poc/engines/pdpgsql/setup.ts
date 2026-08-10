import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  connectDockerNetwork,
  discoverPmmServer,
  docker,
  envFlag,
  ensureDockerNetwork,
  installClient,
  registerPmmService,
  requireDockerImage,
  selectClientSource,
  step,
  type PmmClientConfig,
  resolveClientTarball,
  retry,
  setupPmmAgents,
} from '../../../pmm-client.ts';

export type SetupType = 'single' | 'replication' | 'patroni';
export type Version = '16' | '17' | '18';

export interface Config extends PmmClientConfig {
  version: Version;
  image: string;
  setupType: SetupType;
  nodes: number;
  clientTarball?: string;
  pmmServer?: string;
  postgresPassword: string;
  tls: boolean;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.poc=pdpgsql-prebaked';
const ETCD = 'pdpgsql-etcd';
const PGDATA = '/var/lib/postgresql/data';

function topologyLabel(setupType: SetupType): string {
  return `pmm-qa.pdpgsql.setup-type=${setupType}`;
}

export function parseConfig(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Config {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      version: { type: 'string' },
      image: { type: 'string' },
      'setup-type': { type: 'string' },
      nodes: { type: 'string' },
      'client-tarball': { type: 'string' },
      'client-version': { type: 'string' },
      'pmm-server': { type: 'string' },
      'admin-password': { type: 'string' },
      'postgres-password': { type: 'string' },
      tls: { type: 'boolean' },
      'metrics-mode': { type: 'string' },
      'encrypted-client-config': { type: 'boolean' },
      'client-debug': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`Usage: node setup.ts [options]

  --version 16|17|18
  --setup-type single|replication|patroni
  --nodes NUMBER
  --client-tarball latest|PATH|URL
  --client-version 3-dev-latest|pmm3-rc|pmm3-latest|3.x.y
  --pmm-server HOST[:PORT]
  --encrypted-client-config
  --client-debug`);
    process.exit(0);
  }

  const version = values.version ?? env.PDPGSQL_VERSION ?? '18';
  if (!['16', '17', '18'].includes(version)) throw new Error('version must be 16, 17, or 18');
  const setupType = (values['setup-type'] ?? env.SETUP_TYPE ?? 'single').toLowerCase();
  if (!['single', 'replication', 'patroni'].includes(setupType)) {
    throw new Error('setup type must be single, replication, or patroni');
  }
  const nodes = nodeCount(
    setupType as SetupType,
    values.nodes ?? env.NODES_COUNT,
  );
  const tls = values.tls ?? envFlag(env.TLS);

  const { clientVersion, clientTarball } = selectClientSource(
    values['client-version'] ?? env.CLIENT_VERSION,
    values['client-tarball'] ?? env.CLIENT_TARBALL,
  );

  return {
    version: version as Version,
    image: values.image ?? env.PDPGSQL_IMAGE ?? `pmm-qa/pdpgsql:${version}-prebaked`,
    setupType: setupType as SetupType,
    nodes,
    clientTarball,
    clientVersion,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    postgresPassword:
      values['postgres-password'] ?? env.POSTGRES_PASSWORD ?? 'GRgrO9301RuF',
    tls,
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig:
      values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
  };
}

export function nodeCount(setupType: SetupType, requested?: string): number {
  const minimum = setupType === 'single' ? 1 : setupType === 'replication' ? 2 : 3;
  const nodes = requested === undefined ? minimum : Number(requested);
  if (!Number.isInteger(nodes) || nodes < 1) throw new Error('nodes must be a positive integer');
  if (setupType === 'single' && nodes !== 1) throw new Error('single requires exactly 1 node');
  if (nodes < minimum) throw new Error(`${setupType} requires at least ${minimum} nodes`);
  return nodes;
}

export function containerName(config: Pick<Config, 'setupType' | 'version'>, node: number): string {
  const topology = config.setupType === 'single' ? '' : `_${config.setupType}`;
  return `pdpgsql_pmm${topology}_${config.version}_${node}`;
}

function commonRunArgs(config: Config, node: number): string[] {
  const name = containerName(config, node);
  return [
    'run',
    '--detach',
    '--name',
    name,
    '--hostname',
    name,
    '--label',
    LABEL,
    '--label',
    topologyLabel(config.setupType),
    '--network',
    NETWORK,
    '--env',
    `POSTGRES_PASSWORD=${config.postgresPassword}`,
    '--env',
    `PGDATA=${PGDATA}`,
  ];
}

export function postgresRunArgs(config: Config, node = 1): string[] {
  return [
    ...commonRunArgs(config, node),
    config.image,
    '-c',
    'shared_preload_libraries=pg_stat_monitor',
    '-c',
    'wal_level=replica',
    '-c',
    `max_wal_senders=${Math.max(10, config.nodes)}`,
  ];
}

export function replicaRunArgs(config: Config, node = 2): string[] {
  const primary = containerName(config, 1);
  return [
    ...commonRunArgs(config, node),
    '--entrypoint',
    'sh',
    config.image,
    '-ceu',
    `rm -rf "$PGDATA"/*
PGPASSWORD=replPasswd pg_basebackup -h ${primary} -U replicator -D "$PGDATA" -R -X stream
exec postgres -c shared_preload_libraries=pg_stat_monitor -c hot_standby=on`,
  ];
}

export function patroniRunArgs(config: Config, node: number): string[] {
  const name = containerName(config, node);
  return [
    ...commonRunArgs(config, node),
    '--env',
    `PATRONI_SCOPE=pdpgsql-${config.version}`,
    '--env',
    `PATRONI_NAME=${name}`,
    '--env',
    `PATRONI_RESTAPI_CONNECT_ADDRESS=${name}:8008`,
    '--env',
    'PATRONI_RESTAPI_LISTEN=0.0.0.0:8008',
    '--env',
    `PATRONI_POSTGRESQL_CONNECT_ADDRESS=${name}:5432`,
    '--env',
    'PATRONI_POSTGRESQL_LISTEN=0.0.0.0:5432',
    '--env',
    `PATRONI_POSTGRESQL_DATA_DIR=${PGDATA}`,
    '--env',
    `PATRONI_SUPERUSER_PASSWORD=${config.postgresPassword}`,
    '--env',
    'PATRONI_SUPERUSER_USERNAME=postgres',
    '--env',
    'PATRONI_REPLICATION_PASSWORD=replPasswd',
    '--env',
    'PATRONI_REPLICATION_USERNAME=replicator',
    '--env',
    `PATRONI_ETCD3_HOST=${ETCD}:2379`,
    '--entrypoint',
    'sh',
    config.image,
    '-ceu',
    `${config.tls ? `openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout "${PGDATA}/server.key" -out "${PGDATA}/server.crt"
chmod 600 "${PGDATA}/server.key"
` : ''}printf '%s\n' '{"bootstrap":{"dcs":{"ttl":30,"loop_wait":10,"retry_timeout":10,"postgresql":{"use_pg_rewind":true,"parameters":{"shared_preload_libraries":"pg_stat_monitor","max_wal_senders":${Math.max(10, config.nodes)},"max_replication_slots":${Math.max(10, config.nodes)}${config.tls ? `,"ssl":"on","ssl_cert_file":"${PGDATA}/server.crt","ssl_key_file":"${PGDATA}/server.key"` : ''}}}},"initdb":[{"encoding":"UTF8"},"data-checksums"],"pg_hba":["host all all 0.0.0.0/0 scram-sha-256","host replication replicator 0.0.0.0/0 scram-sha-256"]}}' > /tmp/patroni.yml
exec patroni /tmp/patroni.yml`,
  ];
}

async function cleanup(config: Config): Promise<void> {
  const namePrefix = containerName(config, 1).slice(0, -1);
  const containers = (
    await docker([
      'ps',
      '-aq',
      '--filter',
      `label=${LABEL}`,
      '--filter',
      `name=${namePrefix}`,
    ], true)
  ).stdout.trim().split(/\s+/).filter(Boolean);
  if (config.setupType === 'patroni') {
    const etcd = (await docker(['ps', '-aq', '--filter', `name=${ETCD}`], true)).stdout.trim();
    if (etcd) containers.push(etcd);
  }
  if (containers.length) await docker(['rm', '-fv', ...containers]);
}

async function sql(name: string, statement: string, allowFailure = false): Promise<string> {
  const result = await docker(
    ['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', statement],
    allowFailure,
  );
  return result.stdout.trim();
}

async function waitForPostgres(name: string): Promise<void> {
  await retry(
    `PostgreSQL on ${name}`,
    () => sql(name, 'SELECT 1', true),
    (result) => result === '1',
  );
}

async function configurePrimary(config: Config, name: string): Promise<void> {
  await sql(
    name,
    `CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;
DO $$BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pmm') THEN
    CREATE ROLE pmm LOGIN PASSWORD 'pmm';
  END IF;
END$$;
GRANT pg_monitor TO pmm;`,
  );
  if (config.setupType === 'replication') {
    await sql(
      name,
      `CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replPasswd';`,
    );
    await docker([
      'exec',
      name,
      'sh',
      '-ceu',
      `printf '%s\n' 'host replication replicator 0.0.0.0/0 scram-sha-256' >> "$PGDATA/pg_hba.conf"
pg_ctl reload -D "$PGDATA"`,
    ]);
  }
}

async function enableTls(name: string): Promise<void> {
  await docker(['exec', '--user', 'postgres', name, 'sh', '-ceu',
    `openssl req -new -x509 -days 3650 -nodes -subj '/CN=localhost' -keyout "$PGDATA/server.key" -out "$PGDATA/server.crt"
chmod 600 "$PGDATA/server.key"
psql -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET ssl = 'on'" -c "ALTER SYSTEM SET ssl_cert_file = '$PGDATA/server.crt'" -c "ALTER SYSTEM SET ssl_key_file = '$PGDATA/server.key'"
pg_ctl restart -D "$PGDATA" -w`]);
}

async function startEtcd(config: Config): Promise<void> {
  await docker([
    'run',
    '--detach',
    '--name',
    ETCD,
    '--hostname',
    ETCD,
    '--label',
    LABEL,
    '--label',
    topologyLabel(config.setupType),
    '--network',
    NETWORK,
    '--entrypoint',
    'etcd',
    config.image,
    '--data-dir=/tmp/etcd',
    '--listen-client-urls=http://0.0.0.0:2379',
    `--advertise-client-urls=http://${ETCD}:2379`,
  ]);
  await retry(
    'etcd',
    () => docker(['exec', ETCD, 'etcdctl', 'endpoint', 'health'], true),
    (result) => result.stdout.includes('healthy'),
  );
}

async function startDatabase(config: Config): Promise<string[]> {
  const names = Array.from({ length: config.nodes }, (_, index) =>
    containerName(config, index + 1),
  );
  if (config.setupType === 'patroni') {
    await startEtcd(config);
    for (let node = 1; node <= names.length; node += 1) {
      await docker(patroniRunArgs(config, node));
      await waitForPostgres(names[node - 1]);
    }
    await configurePrimary(config, names[0]);
    return names;
  }

  await docker(postgresRunArgs(config));
  await waitForPostgres(names[0]);
  await configurePrimary(config, names[0]);
  if (config.tls) await enableTls(names[0]);
  if (config.setupType === 'replication') {
    await Promise.all(
      names.slice(1).map(async (name, index) => {
        await docker(replicaRunArgs(config, index + 2));
        await retry(
          `PostgreSQL replica ${index + 2}`,
          () => sql(name, 'SELECT pg_is_in_recovery()', true),
          (result) => result === 't',
        );
      }),
    );
  }
  return names;
}

export function postgresqlRegistrationArgs(config: Config, name: string, suffix: string): string[][] {
  const common = [
    'exec', name, 'pmm-admin', 'add', 'postgresql', '--username=pmm', '--password=pmm',
    '--query-source=pgstatmonitor', '--environment=pdpgsql-dev', `--cluster=pdpgsql-${config.setupType}`,
  ];
  const tcp = [...common, `${name}_${suffix}`, '127.0.0.1:5432'];
  if (config.tls) tcp.push('--tls', '--tls-skip-verify');
  return [tcp, [...common, '--socket=/tmp', `socket_${name}_${suffix}`]];
}

async function registerServices(config: Config, names: string[]): Promise<void> {
  const suffix = String(Date.now()).slice(-5);
  await Promise.all(
    names.flatMap((name) => postgresqlRegistrationArgs(config, name, suffix).map(registerPmmService)),
  );
  if (config.setupType === 'patroni') {
    await Promise.all(
      names.map((name, index) =>
        registerPmmService([
          'exec',
          name,
          'pmm-admin',
          'add',
          'external',
          '--listen-port=8008',
          '--cluster=pdpgsql-patroni',
          `--service-name=patroni_${index + 1}_${suffix}`,
        ]),
      ),
    );
  }
}

async function runWorkload(primary: string): Promise<void> {
  await sql(
    primary,
    `CREATE TABLE IF NOT EXISTS pmm_qa_load(id bigint PRIMARY KEY, value text);
INSERT INTO pmm_qa_load SELECT id, md5(id::text) FROM generate_series(1, 1000) id
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
SELECT count(*) FROM pmm_qa_load;`,
  );
}

async function main(): Promise<void> {
  const config = parseConfig();
  await step('Check Docker', () => docker(['info']));
  await step('Check prebaked image', () => requireDockerImage(config.image, 'npm run build'));
  await step('Clean previous run', () => cleanup(config));
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  const pmmServer = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(pmmServer, NETWORK));
  const names = await step(`Start ${config.setupType} PDPGSQL`, () => startDatabase(config));
  const tarball = await step('Resolve PMM client source', () =>
    config.clientTarball ? resolveClientTarball(config.clientTarball) : Promise.resolve(undefined),
  );
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, pmmServer));
  await step('Register PostgreSQL services', () => registerServices(config, names));
  await step('Run PostgreSQL workload', () => runWorkload(names[0]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
