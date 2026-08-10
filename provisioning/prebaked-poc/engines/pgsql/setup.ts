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
  resolveClientTarball,
  retry,
  selectClientSource,
  setupPmmAgents,
  step,
  type PmmClientConfig,
} from '../../../pmm-client.ts';

type Version = '16' | '17' | '18';
type SetupType = 'single' | 'replication';

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
const LABEL = 'pmm-qa.poc=pgsql-prebaked';
const PGDATA = '/var/lib/pgsql/data';

export function parseConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      version: { type: 'string' }, image: { type: 'string' },
      'setup-type': { type: 'string' }, nodes: { type: 'string' },
      'client-tarball': { type: 'string' }, 'client-version': { type: 'string' },
      'pmm-server': { type: 'string' }, 'admin-password': { type: 'string' },
      'postgres-password': { type: 'string' }, 'metrics-mode': { type: 'string' },
      tls: { type: 'boolean' },
      'encrypted-client-config': { type: 'boolean' }, 'client-debug': { type: 'boolean' },
    },
  });
  const version = values.version ?? env.PGSQL_VERSION ?? '18';
  if (!['16', '17', '18'].includes(version)) throw new Error('version must be 16, 17, or 18');
  const setupType = (values['setup-type'] ?? env.SETUP_TYPE ?? 'single').toLowerCase();
  if (setupType !== 'single' && setupType !== 'replication') {
    throw new Error('setup type must be single or replication');
  }
  const minimum = setupType === 'single' ? 1 : 2;
  const nodes = Number(values.nodes ?? env.NODES_COUNT ?? minimum);
  if (!Number.isInteger(nodes) || nodes < minimum || (setupType === 'single' && nodes !== 1)) {
    throw new Error(`${setupType} requires ${setupType === 'single' ? 'exactly 1 node' : 'at least 2 nodes'}`);
  }
  const client = selectClientSource(
    values['client-version'] ?? env.CLIENT_VERSION,
    values['client-tarball'] ?? env.CLIENT_TARBALL,
  );
  return {
    version: version as Version,
    image: values.image ?? env.PGSQL_IMAGE ?? `pmm-qa/pgsql:${version}-prebaked`,
    setupType: setupType as SetupType,
    nodes,
    ...client,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    postgresPassword: values['postgres-password'] ?? env.POSTGRES_PASSWORD ?? 'GRgrO9301RuF',
    tls: values.tls ?? envFlag(env.TLS),
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig: values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
  };
}

export function containerName(config: Pick<Config, 'version' | 'setupType'>, node: number): string {
  const topology = config.setupType === 'single' ? '' : '_replication';
  return `pgsql_pmm${topology}_${config.version}_${node}`;
}

export function postgresRunArgs(config: Config, node = 1): string[] {
  const name = containerName(config, node);
  const args = [
    'run', '--detach', '--name', name, '--hostname', name,
    '--label', LABEL, '--label', `pmm-qa.pgsql.setup-type=${config.setupType}`,
    '--network', NETWORK, '--env', `POSTGRES_PASSWORD=${config.postgresPassword}`,
    '--env', `PGDATA=${PGDATA}`, config.image,
    '-c', 'shared_preload_libraries=pg_stat_statements',
    '-c', 'wal_level=replica', '-c', `max_wal_senders=${Math.max(10, config.nodes)}`,
  ];
  if (config.tls) args.push('-c', 'ssl=on', '-c', `ssl_cert_file=${PGDATA}/server.crt`, '-c', `ssl_key_file=${PGDATA}/server.key`);
  return args;
}

async function sql(name: string, statement: string, allowFailure = false): Promise<string> {
  return (await docker(['exec', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', statement], allowFailure)).stdout.trim();
}

async function waitForPostgres(name: string): Promise<void> {
  await retry(`PostgreSQL on ${name}`, () => sql(name, 'SELECT 1', true), (value) => value === '1');
}

export function replicaRunArgs(config: Config, primary: string, node: number): string[] {
  const name = containerName(config, node);
  return [
    'run', '--detach', '--name', name, '--hostname', name, '--label', LABEL,
    '--label', 'pmm-qa.pgsql.setup-type=replication', '--network', NETWORK,
    '--env', `PGDATA=${PGDATA}`, '--entrypoint', 'sh', config.image, '-ceu',
    `rm -rf "$PGDATA"/*; chmod 700 "$PGDATA"; PGPASSWORD=replPasswd pg_basebackup -h ${primary} -U replicator -D "$PGDATA" -R -X stream; exec postgres -D "$PGDATA" -c listen_addresses='*' -c shared_preload_libraries=pg_stat_statements -c hot_standby=on${config.tls ? ` -c ssl=on -c ssl_cert_file=${PGDATA}/server.crt -c ssl_key_file=${PGDATA}/server.key` : ''}`,
  ];
}

async function startDatabase(config: Config): Promise<string[]> {
  const names = Array.from({ length: config.nodes }, (_, index) => containerName(config, index + 1));
  await docker(postgresRunArgs(config));
  await waitForPostgres(names[0]);
  await sql(names[0], `ALTER USER postgres PASSWORD '${config.postgresPassword}';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE ROLE pmm LOGIN PASSWORD 'pmm'; GRANT pg_monitor TO pmm;`);
  if (config.setupType === 'replication') {
    await sql(names[0], "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replPasswd';");
    await docker(['exec', names[0], 'sh', '-ceu', `printf '%s\n' 'host replication replicator 0.0.0.0/0 scram-sha-256' >> "$PGDATA/pg_hba.conf"; pg_ctl reload -D "$PGDATA"`]);
    await Promise.all(names.slice(1).map(async (name, index) => {
      await docker(replicaRunArgs(config, names[0], index + 2));
      await retry(`PostgreSQL replica ${index + 2}`, () => sql(name, 'SELECT pg_is_in_recovery()', true), (value) => value === 't');
    }));
  }
  return names;
}

async function cleanup(): Promise<void> {
  const ids = (await docker(['ps', '-aq', '--filter', `label=${LABEL}`], true)).stdout.trim().split(/\s+/).filter(Boolean);
  if (ids.length) await docker(['rm', '-fv', ...ids]);
}

async function main(): Promise<void> {
  const config = parseConfig();
  await step('Check Docker', () => docker(['info']));
  await step('Check prebaked image', () => requireDockerImage(config.image, 'npm run build'));
  await step('Clean previous run', cleanup);
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  const server = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(server, NETWORK));
  const names = await step(`Start ${config.setupType} PostgreSQL`, () => startDatabase(config));
  const tarball = config.clientTarball ? await resolveClientTarball(config.clientTarball) : undefined;
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, server));
  await step('Register PostgreSQL services', () => Promise.all(names.map((name) => {
    const args = ['exec', name, 'pmm-admin', 'add', 'postgresql', '--username=pmm', '--password=pmm',
      '--query-source=pgstatements', '--environment=pgsql-dev', `--cluster=pgsql-${config.setupType}`];
    if (config.tls) args.push('--tls', '--tls-skip-verify');
    args.push(name, '127.0.0.1:5432');
    return registerPmmService(args);
  })).then(() => undefined));
  await step('Run PostgreSQL workload', () => sql(names[0], 'CREATE TABLE IF NOT EXISTS pmm_qa_load AS SELECT generate_series(1,1000) id; SELECT count(*) FROM pmm_qa_load;'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
