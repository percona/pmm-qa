import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
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

export type PxcVersion = '5.7' | '8.0';
export type QuerySource = 'perfschema' | 'slowlog';

export interface Config extends PmmClientConfig {
  version: PxcVersion;
  image: string;
  nodes: number;
  querySource: QuerySource;
  clientTarball?: string;
  pmmServer?: string;
  rootPassword: string;
  cluster: string;
  proxyImage: string;
  skipWorkload: boolean;
  workloadSeconds: number;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.poc=pxc-prebaked';
const PROXY = 'pxc-proxy';

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
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
      nodes: { type: 'string' },
      'query-source': { type: 'string' },
      'client-tarball': { type: 'string' },
      'client-version': { type: 'string' },
      'pmm-server': { type: 'string' },
      'admin-password': { type: 'string' },
      'root-password': { type: 'string' },
      cluster: { type: 'string' },
      'proxy-image': { type: 'string' },
      'metrics-mode': { type: 'string' },
      'encrypted-client-config': { type: 'boolean' },
      'client-debug': { type: 'boolean' },
      'skip-workload': { type: 'boolean' },
      'workload-seconds': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`Usage: node setup.ts [options]

  --version 5.7|8.0
  --nodes NUMBER
  --query-source perfschema|slowlog
  --client-tarball latest|PATH|URL
  --client-version 3-dev-latest|pmm3-rc|pmm3-latest|3.x.y
  --pmm-server HOST[:PORT]
  --cluster NAME
  --proxy-image IMAGE
  --encrypted-client-config
  --client-debug
  --skip-workload
  --workload-seconds NUMBER`);
    process.exit(0);
  }

  const version = values.version ?? env.PXC_VERSION ?? '8.0';
  if (version !== '5.7' && version !== '8.0') throw new Error('version must be 5.7 or 8.0');
  const nodes = positiveInteger(values.nodes ?? env.PXC_NODES ?? '3', 'nodes');
  if (nodes < 3) throw new Error('PXC requires at least 3 nodes');
  const querySource = (values['query-source'] ?? env.QUERY_SOURCE ?? 'perfschema').toLowerCase();
  if (querySource !== 'perfschema' && querySource !== 'slowlog') {
    throw new Error('query source must be perfschema or slowlog');
  }

  const { clientVersion, clientTarball } = selectClientSource(
    values['client-version'] ?? env.CLIENT_VERSION,
    values['client-tarball'] ?? env.CLIENT_TARBALL ?? env.PXC_CLIENT_TARBALL,
  );

  return {
    version,
    image: values.image ?? env.PXC_IMAGE ?? `pmm-qa/pxc:${version}-prebaked`,
    nodes,
    querySource,
    clientTarball,
    clientVersion,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    rootPassword: values['root-password'] ?? env.ROOT_PASSWORD ?? 'GRgrO9301RuF',
    cluster: values.cluster ?? env.PXC_CLUSTER_NAME ?? 'pxc-dev-cluster',
    proxyImage: values['proxy-image'] ?? env.PROXYSQL_IMAGE ?? 'pmm-qa/proxysql:2-prebaked',
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig:
      values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
    skipWorkload: values['skip-workload'] ?? envFlag(env.SKIP_WORKLOAD),
    workloadSeconds: positiveInteger(
      values['workload-seconds'] ?? env.WORKLOAD_SECONDS ?? '30',
      'workload seconds',
    ),
  };
}

export function containerName(node: number): string {
  return `pxc_pmm_${node}`;
}

export function pxcRunArgs(config: Config, node: number): string[] {
  const name = containerName(node);
  const args = [
    'run',
    '--detach',
    '--name',
    name,
    '--hostname',
    name,
    '--label',
    LABEL,
    '--network',
    NETWORK,
    '--env',
    `MYSQL_ROOT_PASSWORD=${config.rootPassword}`,
    '--env',
    `CLUSTER_NAME=${config.cluster}`,
  ];
  if (node > 1) args.push('--env', `CLUSTER_JOIN=${containerName(1)}`);
  args.push(
    config.image,
    `--wsrep-node-name=${name}`,
    '--pxc-encrypt-cluster-traffic=OFF',
    '--max-connections=1000',
  );
  if (config.querySource === 'slowlog') {
    args.push('--slow-query-log=ON', '--long-query-time=0', '--log-slow-verbosity=full');
  }
  return args;
}

async function cleanup(): Promise<void> {
  const containers = (
    await docker(['ps', '-aq', '--filter', `label=${LABEL}`], true)
  ).stdout.trim().split(/\s+/).filter(Boolean);
  if (containers.length) await docker(['rm', '-fv', ...containers]);
}

async function mysql(
  name: string,
  password: string,
  sql: string,
  allowFailure = false,
): Promise<string> {
  const result = await docker([
    'exec',
    name,
    'mysql',
    '-uroot',
    `-p${password}`,
    '--batch',
    '--skip-column-names',
    '-e',
    sql,
  ], allowFailure);
  return result.stdout.trim();
}

async function startNodes(config: Config): Promise<string[]> {
  const names: string[] = [];
  for (let node = 1; node <= config.nodes; node += 1) {
    const name = containerName(node);
    await docker(pxcRunArgs(config, node));
    if (node === 1) {
      await retry(
        `${name} to bootstrap`,
        () => mysql(name, config.rootPassword, "SHOW STATUS LIKE 'wsrep_ready';", true),
        (status) => status.endsWith('\tON'),
      );
      await retry(
        `${name} to become primary`,
        () =>
          mysql(
            name,
            config.rootPassword,
            "SHOW STATUS WHERE Variable_name IN ('wsrep_cluster_status','wsrep_local_state_comment');",
            true,
          ),
        (status) =>
          status.includes('wsrep_cluster_status\tPrimary') &&
          status.includes('wsrep_local_state_comment\tSynced'),
      );
      await sleep(15_000);
    } else {
      await retry(
        `${node} PXC members`,
        () => mysql(names[0], config.rootPassword, "SHOW STATUS LIKE 'wsrep_cluster_size';", true),
        (status) => status.endsWith(`\t${node}`),
      );
      await retry(
        `${name} to sync`,
        () =>
          mysql(
            name,
            config.rootPassword,
            "SHOW STATUS LIKE 'wsrep_local_state_comment';",
            true,
          ),
        (status) => status.endsWith('\tSynced'),
      );
      await retry(
        `${names[0]} to finish donor state`,
        () =>
          mysql(
            names[0],
            config.rootPassword,
            "SHOW STATUS LIKE 'wsrep_local_state_comment';",
            true,
          ),
        (status) => status.endsWith('\tSynced'),
      );
    }
    names.push(name);
  }
  return names;
}

async function configureUsers(config: Config, first: string): Promise<void> {
  await mysql(
    first,
    config.rootPassword,
    `CREATE USER IF NOT EXISTS 'pmm'@'%' IDENTIFIED BY 'pmm';
     GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD ON *.* TO 'pmm'@'%';
     CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY 'admin';
     GRANT ALL PRIVILEGES ON *.* TO 'admin'@'%' WITH GRANT OPTION;`,
  );
}

export function proxyRunArgs(config: Pick<Config, 'proxyImage'>): string[] {
  return [
    'run',
    '--detach',
    '--name',
    PROXY,
    '--label',
    LABEL,
    '--network',
    NETWORK,
    '--publish',
    '6032',
    '--publish',
    '6033',
    config.proxyImage,
  ];
}

async function startProxy(config: Config, nodeCount: number): Promise<void> {
  await requireDockerImage(config.proxyImage, 'npm run build -- <version>');
  await docker(proxyRunArgs(config));
  await retry(
    'ProxySQL admin interface',
    () =>
      docker(
        [
          'exec',
          PROXY,
          'mysql',
          '-h127.0.0.1',
          '-P6032',
          '-uadmin',
          '-padmin',
          '-e',
          'SELECT 1',
        ],
        true,
      ),
    (result) => result.stdout.includes('1'),
  );
  await docker([
    'exec',
    PROXY,
    'proxysql-admin',
    '--config-file=/etc/proxysql-admin.cnf',
    '--enable',
  ]);
  await retry(
    `${nodeCount} ProxySQL PXC backends`,
    () =>
      docker(
        [
          'exec',
          PROXY,
          'mysql',
          '-h127.0.0.1',
          '-P6032',
          '-uadmin',
          '-padmin',
          '--batch',
          '--skip-column-names',
          '-e',
          'SELECT COUNT(DISTINCT hostname) FROM runtime_mysql_servers WHERE hostgroup_id IN (10,11,12,13)',
        ],
        true,
      ),
    (result) => result.stdout.trim() === String(nodeCount),
  );
}

async function registerServices(config: Config, names: string[]): Promise<void> {
  const suffix = String(Date.now()).slice(-5);
  await Promise.all(
    names.map((name) =>
      registerPmmService([
        'exec',
        name,
        'pmm-admin',
        'add',
        'mysql',
        `--query-source=${config.querySource}`,
        '--username=pmm',
        '--password=pmm',
        '--environment=pxc-dev',
        `--cluster=${config.cluster}`,
        '--replication-set=pxc-repl',
        `${name}_${suffix}`,
        '127.0.0.1:3306',
      ]),
    ),
  );
  await registerPmmService([
    'exec',
    names[0],
    'pmm-admin',
    'add',
    'proxysql',
    '--username=read_user',
    '--password=read_user',
    `--service-name=pxc-proxysql_${suffix}`,
    `--cluster=${config.cluster}`,
    `--host=${PROXY}`,
    '--port=6032',
  ]);
}

async function runWorkload(config: Config, first: string): Promise<void> {
  if (config.skipWorkload) return;
  await mysql(
    first,
    config.rootPassword,
    `CREATE DATABASE IF NOT EXISTS sbtest;
     GRANT ALL PRIVILEGES ON sbtest.* TO 'proxysql_user'@'%';`,
  );
  const args = [
    'exec',
    first,
    'sysbench',
    '/usr/share/sysbench/oltp_read_write.lua',
    `--mysql-host=${PROXY}`,
    '--mysql-port=6033',
    '--mysql-user=proxysql_user',
    '--mysql-password=passw0rd',
    '--mysql-db=sbtest',
    '--tables=10',
    '--table-size=1000',
  ];
  await docker([...args, 'prepare']);
  await docker([...args, '--threads=16', `--time=${config.workloadSeconds}`, 'run']);
}

async function main(): Promise<void> {
  const config = parseConfig();
  await step('Check Docker', () => docker(['info']));
  await step('Check prebaked image', () =>
    requireDockerImage(config.image, 'npm run build -- <version>'),
  );
  await step('Clean previous run', cleanup);
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  const pmmServer = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(pmmServer, NETWORK));
  const names = await step('Start PXC nodes', () => startNodes(config));
  await step('Configure database users', () => configureUsers(config, names[0]));
  await step('Configure Galera-aware ProxySQL', () => startProxy(config, names.length));
  const tarball = await step('Resolve PMM client source', () =>
    config.clientTarball ? resolveClientTarball(config.clientTarball) : Promise.resolve(undefined),
  );
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, pmmServer));
  await step('Register PXC and ProxySQL', () => registerServices(config, names));
  await step('Run ProxySQL workload', () => runWorkload(config, names[0]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
