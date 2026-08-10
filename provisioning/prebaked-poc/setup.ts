import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
} from '../pmm-client.ts';
import {
  defaultImage,
  defaultVersion,
  ENGINES,
  MINIMUM_NODES,
  normalizeEngine,
  normalizeVersion,
  type DbVersion,
  type Engine,
  type QuerySource,
  type SetupType,
} from './lib/engines.ts';

export type { DbVersion, Engine, QuerySource, SetupType };

export interface Config extends PmmClientConfig {
  engine: Engine;
  version: DbVersion;
  image: string;
  setupType: SetupType;
  nodes: number;
  querySource: QuerySource;
  clientTarball?: string;
  pmmServer?: string;
  rootPassword: string;
  myRocks: boolean;
  backup: boolean;
  buckets: string[];
  tls: boolean;
  skipWorkload: boolean;
  workloadSeconds: number;
}

export function replicationCommands(version: DbVersion) {
  const source = version === '5.7' ? 'MASTER' : 'SOURCE';
  const replica = version === '5.7' ? 'SLAVE' : 'REPLICA';
  return {
    change: `CHANGE ${version === '5.7' ? 'MASTER' : 'REPLICATION SOURCE'} TO`,
    sourceHost: `${source}_HOST`, sourcePort: `${source}_PORT`,
    sourceUser: `${source}_USER`, sourcePassword: `${source}_PASSWORD`,
    autoPosition: `${source}_AUTO_POSITION`, start: `START ${replica}`,
    status: `SHOW ${replica} STATUS`, ioRunning: `${replica}_IO_Running: Yes`,
    sqlRunning: `${replica}_SQL_Running: Yes`,
  };
}

const NETWORK = 'pmm-qa';
const MINIO_CONTAINER = 'prebaked-poc-minio';
const MINIO_VOLUME = 'prebaked-poc-minio-backups';
const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const SCHOOL_LOAD = resolve(ROOT_DIR, 'mysql_load.sql');

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function normalizeSetupType(value: string): SetupType {
  const normalized = value.toLowerCase();
  if (normalized === '' || normalized === 'single') return 'single';
  if (normalized === 'replication' || normalized === 'gr') return normalized;
  throw new Error('setup type must be single, replication, or gr');
}

export function parseConfig(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Config {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      engine: { type: 'string' },
      version: { type: 'string' },
      image: { type: 'string' },
      'setup-type': { type: 'string' },
      nodes: { type: 'string' },
      'query-source': { type: 'string' },
      'client-tarball': { type: 'string' },
      'client-version': { type: 'string' },
      'pmm-server': { type: 'string' },
      'admin-password': { type: 'string' },
      'root-password': { type: 'string' },
      'metrics-mode': { type: 'string' },
      'my-rocks': { type: 'boolean' },
      backup: { type: 'boolean' },
      buckets: { type: 'string' },
      tls: { type: 'boolean' },
      'encrypted-client-config': { type: 'boolean' },
      'client-debug': { type: 'boolean' },
      'skip-workload': { type: 'boolean' },
      'workload-seconds': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`Usage: node setup.ts [options]

  --engine ENGINE[=VERSION,OPTION=VALUE] (repeatable)
  --version 5.7|8.0|8.4|9.7 (single engine; mysql only for 9.7)
  --setup-type single|replication|gr (global default or engine option)
  --nodes NUMBER                    (global default or engine option)
  --query-source perfschema|slowlog (global default or engine option)
  --client-tarball latest|PATH|URL
  --client-version pmm3-rc
  --pmm-server HOST[:PORT]
  --my-rocks            (ps only)
  --backup              (ps only)
  --buckets NAME[,NAME] (single PS engine only)
  --tls                 monitor MySQL over TLS
  --encrypted-client-config
  --client-debug
  --skip-workload
  --workload-seconds NUMBER`);
    process.exit(0);
  }

  const engine = normalizeEngine(values.engine, env);
  const version = normalizeVersion(engine, values.version ?? defaultVersion(engine, env));
  const setupType = normalizeSetupType(values['setup-type'] ?? env.SETUP_TYPE ?? 'single');
  const defaultNodes = String(MINIMUM_NODES[setupType]);
  const nodes = positiveInteger(values.nodes ?? env.NODES_COUNT ?? defaultNodes, 'nodes');
  if (nodes < MINIMUM_NODES[setupType]) {
    throw new Error(`${setupType} requires at least ${MINIMUM_NODES[setupType]} nodes`);
  }

  const querySource = (values['query-source'] ?? env.QUERY_SOURCE ?? 'perfschema').toLowerCase();
  if (querySource !== 'perfschema' && querySource !== 'slowlog') {
    throw new Error('query source must be perfschema or slowlog');
  }

  const workloadSeconds = positiveInteger(
    values['workload-seconds'] ?? env.WORKLOAD_SECONDS ?? '30',
    'workload seconds',
  );
  const { clientVersion, clientTarball } = selectClientSource(
    values['client-version'] ?? env.CLIENT_VERSION,
    values['client-tarball'] ?? env.CLIENT_TARBALL,
  );
  if (
    clientVersion &&
    !['3-dev-latest', 'pmm3-rc', 'pmm3-latest'].includes(clientVersion) &&
    !/^3\.\d+\.\d+$/.test(clientVersion)
  ) {
    throw new Error(
      'client version must be 3-dev-latest, pmm3-rc, pmm3-latest, 3.x.y, latest-tarball, or a tarball URL',
    );
  }

  if (engine === 'mysql' && (values['my-rocks'] || values.backup || values.buckets)) {
    throw new Error('--my-rocks, --backup, and --buckets are only supported with --engine ps');
  }

  return {
    engine,
    version,
    image: defaultImage(engine, version, env, values.image),
    setupType,
    nodes,
    querySource: querySource as QuerySource,
    clientTarball,
    clientVersion,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    rootPassword: values['root-password'] ?? env.ROOT_PASSWORD ?? 'GRgrO9301RuF',
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? env.metrics_mode ?? 'auto',
    myRocks: engine === 'ps' && (values['my-rocks'] ?? envFlag(env.MY_ROCKS)),
    backup: engine === 'ps' && (values.backup ?? envFlag(env.BACKUP)),
    buckets:
      engine === 'ps'
        ? (values.buckets ?? env.BUCKETS ?? 'bcp')
            .split(',')
            .map((bucket) => bucket.trim())
            .filter(Boolean)
        : [],
    tls: values.tls ?? envFlag(env.TLS),
    encryptedClientConfig:
      values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
    skipWorkload: values['skip-workload'] ?? envFlag(env.SKIP_WORKLOAD),
    workloadSeconds,
  };
}

export function containerName(
  config: Pick<Config, 'engine' | 'setupType' | 'version'>,
  node: number,
): string {
  const topology = config.setupType === 'single' ? '' : `_${config.setupType}`;
  return `${ENGINES[config.engine].containerPrefix}${topology}_${config.version.replace('.', '_')}_${node}`;
}

export function mysqlArguments(config: Config, node: number): string[] {
  const name = containerName(config, node);
  const args = [
    `--server-id=${node}`,
    `--report-host=${name}`,
    '--bind-address=0.0.0.0',
    '--max-connections=1000',
    '--innodb-buffer-pool-size=256M',
  ];
  if (config.engine === 'ps') args.splice(3, 0, '--userstat=1');

  if (config.setupType === 'single') return args;

  args.push(
    '--gtid-mode=ON',
    '--enforce-gtid-consistency=ON',
    '--log-bin=binlog',
    config.version === '5.7' ? '--log-slave-updates=ON' : '--log-replica-updates=ON',
    '--binlog-checksum=NONE',
    `--relay-log=${name}-relay-bin`,
    '--relay-log-recovery=ON',
  );

  if (config.setupType === 'gr') {
    const seeds = Array.from(
      { length: config.nodes },
      (_, index) => `${containerName(config, index + 1)}:34061`,
    ).join(',');
    if (config.version === '5.7') {
      args.push(
        '--binlog-format=ROW',
        '--master-info-repository=TABLE',
        '--relay-log-info-repository=TABLE',
        '--transaction-write-set-extraction=XXHASH64',
      );
    }
    args.push(
      '--plugin-load-add=group_replication.so',
      '--loose-group-replication-group-name=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      `--loose-group-replication-local-address=${name}:34061`,
      `--loose-group-replication-group-seeds=${seeds}`,
      '--loose-group-replication-communication-stack=XCOM',
      '--loose-group-replication-start-on-boot=OFF',
      '--loose-group-replication-bootstrap-group=OFF',
      '--loose-group-replication-single-primary-mode=ON',
      '--loose-group-replication-enforce-update-everywhere-checks=OFF',
      '--loose-group-replication-recovery-retry-count=10',
      '--loose-group-replication-recovery-reconnect-interval=60',
    );
    if (config.version !== '5.7') {
      args.push('--loose-group-replication-recovery-get-public-key=ON');
    }
  }

  return args;
}

function pocLabel(engine: Engine): string {
  return ENGINES[engine].label;
}

export function topologyLabel(config: Pick<Config, 'engine' | 'setupType'>): string {
  return `pmm-qa.${config.engine}.setup-type=${config.setupType}`;
}

async function cleanup(config: Config): Promise<void> {
  const namePrefix = containerName(config, 1).slice(0, -1);
  const containers = (
    await docker([
      'ps',
      '-aq',
      '--filter',
      `label=${pocLabel(config.engine)}`,
      '--filter',
      `name=${namePrefix}`,
    ], true)
  ).stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (containers.length) await docker(['rm', '-fv', ...containers]);
  if (config.engine === 'ps' && config.backup) {
    await docker(['volume', 'rm', '-f', MINIO_VOLUME], true);
  }
}

async function startNodes(config: Config): Promise<string[]> {
  const names = Array.from({ length: config.nodes }, (_, index) => containerName(config, index + 1));
  await Promise.all(
    names.map((name, index) => {
      const args = [
        'run',
        '--detach',
        '--name',
        name,
        '--hostname',
        name,
        '--label',
        pocLabel(config.engine),
        '--label',
        topologyLabel(config),
        '--network',
        NETWORK,
        '--publish',
        '3306',
        '--env',
        `MYSQL_ROOT_PASSWORD=${config.rootPassword}`,
      ];
      if (config.engine === 'ps' && config.myRocks) args.push('--env', 'INIT_ROCKSDB=1');
      args.push(config.image, ...mysqlArguments(config, index + 1));
      return registerPmmService(args);
    }),
  );

  await Promise.all(
    names.map(async (name) => {
      try {
        await retry(
          `${name} to accept MySQL connections`,
          () =>
            docker(
              [
                'exec',
                name,
                'mysqladmin',
                'ping',
                '--host=127.0.0.1',
                '--protocol=tcp',
                '-uroot',
                `-p${config.rootPassword}`,
                '--silent',
              ],
              true,
            ),
          (result) => result.stdout.includes('mysqld is alive'),
        );
      } catch (error) {
        const logs = await docker(['logs', name], true);
        throw new Error(`${error instanceof Error ? error.message : error}\n${logs.stderr}${logs.stdout}`);
      }
    }),
  );
  return names;
}

async function mysql(container: string, password: string, sql: string): Promise<string> {
  const result = await docker([
    'exec',
    container,
    'mysql',
    '-uroot',
    `-p${password}`,
    '--batch',
    '--skip-column-names',
    '-e',
    sql,
  ]);
  return result.stdout.trim();
}

async function mysqlVertical(container: string, password: string, sql: string): Promise<string> {
  const result = await docker([
    'exec',
    container,
    'mysql',
    '-uroot',
    `-p${password}`,
    '--vertical',
    '-e',
    sql,
  ]);
  return result.stdout;
}

async function configureReplication(config: Config, names: string[]): Promise<void> {
  const [primary, ...replicas] = names;
  const commands = replicationCommands(config.version);
  await mysql(
    primary,
    config.rootPassword,
    `CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'GRgrO9301RuF';
     GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';`,
  );
  await Promise.all(
    replicas.map((replica) =>
      mysql(
        replica,
        config.rootPassword,
        `${commands.change}
           ${commands.sourceHost}='${primary}',
           ${commands.sourcePort}=3306,
           ${commands.sourceUser}='repl_user',
           ${commands.sourcePassword}='GRgrO9301RuF',
           ${commands.autoPosition}=1${config.version === '5.7' ? '' : ',\n           GET_SOURCE_PUBLIC_KEY=1'};
         ${commands.start};`,
      ),
    ),
  );
  await Promise.all(
    replicas.map((replica) =>
      retry(
        `${replica} replication threads`,
        () => mysqlVertical(replica, config.rootPassword, commands.status),
        (status) =>
          status.includes(commands.ioRunning) && status.includes(commands.sqlRunning),
      ),
    ),
  );
}

async function configureGroupReplication(config: Config, names: string[]): Promise<void> {
  const credentials =
    config.version === '5.7'
      ? `GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
         CHANGE MASTER TO
           MASTER_USER='repl_user',
           MASTER_PASSWORD='GRgrO9301RuF'
           FOR CHANNEL 'group_replication_recovery';`
      : `GRANT REPLICATION SLAVE, CONNECTION_ADMIN, BACKUP_ADMIN,
           GROUP_REPLICATION_STREAM, SERVICE_CONNECTION_ADMIN,
           SYSTEM_VARIABLES_ADMIN ON *.* TO 'repl_user'@'%';
         CHANGE REPLICATION SOURCE TO
           SOURCE_USER='repl_user',
           SOURCE_PASSWORD='GRgrO9301RuF'
           FOR CHANNEL 'group_replication_recovery';`;
  await Promise.all(
    names.map((name) =>
      mysql(
        name,
        config.rootPassword,
        `SET SQL_LOG_BIN=0;
         CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'GRgrO9301RuF';
         ${credentials}
         SET SQL_LOG_BIN=1;`,
      ),
    ),
  );
  await mysql(
    names[0],
    config.rootPassword,
    `SET GLOBAL group_replication_bootstrap_group=ON;
     START GROUP_REPLICATION;
     SET GLOBAL group_replication_bootstrap_group=OFF;`,
  );
  await Promise.all(
    names.slice(1).map((name) =>
      mysql(name, config.rootPassword, 'START GROUP_REPLICATION;'),
    ),
  );
  await retry(
    `${names.length} online GR members`,
    () =>
      mysql(
        names[0],
        config.rootPassword,
        `SELECT COUNT(*) FROM performance_schema.replication_group_members
         WHERE MEMBER_STATE='ONLINE';`,
      ),
    (count) => count === String(names.length),
  );
}

async function configureTopology(config: Config, names: string[]): Promise<void> {
  if (config.setupType === 'replication') await configureReplication(config, names);
  if (config.setupType === 'gr') await configureGroupReplication(config, names);

  const uuids = await Promise.all(
    names.map((name) => mysql(name, config.rootPassword, 'SELECT @@server_uuid;')),
  );
  if (new Set(uuids).size !== names.length) throw new Error('database nodes share a server UUID');

  if (config.setupType !== 'single') {
    await mysql(
      names[0],
      config.rootPassword,
      `CREATE DATABASE IF NOT EXISTS testdb;
       CREATE TABLE IF NOT EXISTS testdb.testdb (
         id INT PRIMARY KEY,
         data VARCHAR(100)
       );
       INSERT INTO testdb.testdb VALUES (1, 'Initial data from node mysql1')
         ON DUPLICATE KEY UPDATE data=VALUES(data);`,
    );
    await Promise.all(
      names.slice(1).map((name) =>
        retry(
          `test row on ${name}`,
          () =>
            mysql(
              name,
              config.rootPassword,
              'SELECT COUNT(*) FROM testdb.testdb WHERE id=1;',
            ),
          (count) => count === '1',
        ),
      ),
    );
  }
}

async function startMinio(config: Config, buckets: string[]): Promise<void> {
  await docker(['volume', 'create', MINIO_VOLUME]);
  await docker([
    'run',
    '--detach',
    '--name',
    MINIO_CONTAINER,
    '--label',
    ENGINES.ps.label,
    '--label',
    topologyLabel(config),
    '--network',
    NETWORK,
    '--volume',
    `${MINIO_VOLUME}:/data`,
    '--env',
    'MINIO_ROOT_USER=minio1234',
    '--env',
    'MINIO_ROOT_PASSWORD=minio1234',
    '--publish',
    '9010:9000',
    '--publish',
    '9001:9001',
    'minio/minio',
    'server',
    '/data',
    '--console-address',
    ':9001',
  ]);
  await retry(
    'MinIO',
    () =>
      docker(
        [
          'exec',
          MINIO_CONTAINER,
          'mc',
          'alias',
          'set',
          'local',
          'http://127.0.0.1:9000',
          'minio1234',
          'minio1234',
        ],
        true,
      ),
    (result) => result.stdout.includes('Added') || result.stdout.includes('successfully'),
  );
  await Promise.all(
    buckets.map((bucket) =>
      docker(['exec', MINIO_CONTAINER, 'mc', 'mb', '--ignore-existing', `local/${bucket}`]),
    ),
  );
}

async function configureDatabaseFeatures(config: Config, names: string[]): Promise<void> {
  if (config.querySource === 'slowlog') {
    await Promise.all(
      names.map((name) =>
        mysql(
          name,
          config.rootPassword,
          `SET GLOBAL slow_query_log=ON;
            SET GLOBAL long_query_time=0;
            SET GLOBAL log_slow_admin_statements=ON;
            SET GLOBAL ${config.version === '5.7' ? 'log_slow_slave_statements' : 'log_slow_replica_statements'}=ON;`,
        ),
      ),
    );
  }

  if (config.engine === 'ps' && config.myRocks) {
    await Promise.all(
      names.map(async (name) => {
        const enabled = await mysql(
          name,
          config.rootPassword,
          `SELECT COUNT(*) FROM information_schema.engines
           WHERE engine='ROCKSDB' AND support IN ('YES', 'DEFAULT');`,
        );
        if (enabled !== '1') throw new Error(`MyRocks is not enabled on ${name}`);
      }),
    );
  }

  if (config.engine === 'ps' && config.backup) {
    await Promise.all(
      names.map((name) =>
        docker(['exec', '--user', 'root', name, 'xtrabackup', '--version']),
      ),
    );
    await startMinio(config, config.buckets);
  }
}

async function registerMysqlWithPmm(config: Config, names: string[]): Promise<void> {
  const suffix = String(Date.now()).slice(-5);
  const pmm = ENGINES[config.engine].pmm;
  await Promise.all(
    names.map((name) => {
      const args = [
        'exec',
        name,
        'pmm-admin',
        'add',
        'mysql',
        `--query-source=${config.querySource}`,
        '--username=root',
        `--password=${config.rootPassword}`,
      ];
      if (config.tls) args.push('--tls', '--tls-skip-verify');
      if (config.setupType === 'gr') {
        args.push(
          `--environment=${pmm.gr.environment}`,
          `--cluster=${pmm.gr.cluster}`,
          `--replication-set=${pmm.gr.replicationSet}`,
        );
      } else if (config.setupType === 'replication') {
        args.push(
          `--environment=${pmm.replication.environment}`,
          `--cluster=${pmm.replication.cluster}`,
          `--replication-set=${pmm.replication.replicationSet}`,
        );
      } else {
        args.push(`--environment=${pmm.single.environment}`, `--cluster=${pmm.single.cluster}`);
      }
      args.push('--debug', `${name}_${suffix}`, '127.0.0.1:3306');
      return docker(args);
    }),
  );

  await Promise.all(
    names.map((name) =>
      retry(
        `PMM MySQL exporter on ${name}`,
        () => docker(['exec', name, 'pmm-admin', 'status'], true),
        (result) =>
          /mysqld_exporter/i.test(result.stdout) &&
          /(running|waiting)/i.test(result.stdout),
      ),
    ),
  );
}

async function runWorkload(config: Config, names: string[]): Promise<void> {
  if (config.skipWorkload) return;
  const targets = config.setupType === 'single' ? names : names.slice(0, 1);

  await Promise.all(
    targets.map(async (name) => {
      await mysql(
        name,
        config.rootPassword,
        `SET GLOBAL super_read_only=OFF;
         SET GLOBAL read_only=OFF;
         CREATE DATABASE sbtest;
         CREATE USER 'sbtest'@'localhost' IDENTIFIED BY 'password';
         GRANT ALL PRIVILEGES ON *.* TO 'sbtest'@'localhost';
         CREATE USER 'sbtest'@'127.0.0.1' IDENTIFIED BY 'password';
         GRANT ALL PRIVILEGES ON *.* TO 'sbtest'@'127.0.0.1';
         FLUSH PRIVILEGES;`,
      );

      const args = [
        'exec',
        name,
        'sysbench',
        '/usr/share/sysbench/oltp_read_write.lua',
        '--mysql-host=127.0.0.1',
        '--mysql-port=3306',
        '--mysql-user=sbtest',
        '--mysql-password=password',
        '--mysql-db=sbtest',
        '--tables=10',
        '--table-size=100000',
      ];
      await docker([...args, '--threads=10', 'prepare']);
      await docker([
        ...args,
        '--threads=16',
        `--time=${config.workloadSeconds}`,
        'run',
      ]);
    }),
  );

  const schoolLoad = await readFile(SCHOOL_LOAD, 'utf8');
  await Promise.all(
    targets.map((name) =>
      mysql(name, config.rootPassword, `CREATE DATABASE school; USE school;\n${schoolLoad}`),
    ),
  );
}

async function provision(
  config: Config,
  pmmServer: string,
  tarball: string | undefined,
): Promise<void> {
  const names = await step('Start database nodes', () => startNodes(config));
  await step('Configure database topology', () => configureTopology(config, names));
  await step('Configure database features', () => configureDatabaseFeatures(config, names));
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, pmmServer));
  await step('Register MySQL with PMM', () => registerMysqlWithPmm(config, names));
  await step('Run workload', () => runWorkload(config, names));
}

async function main(): Promise<void> {
  const totalStarted = performance.now();
  const config = parseConfig();

  await step('Check Docker', () => docker(['info']));
  await step('Check prebaked image', () =>
    requireDockerImage(config.image, 'npm run build -- <engine> <version>'),
  );
  await step('Clean previous run', () => cleanup(config));
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  const pmmServer = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(pmmServer, NETWORK));
  const tarball = await step('Resolve PMM client source', () =>
    config.clientTarball
      ? resolveClientTarball(config.clientTarball)
      : Promise.resolve(undefined),
  );
  await provision(config, pmmServer, tarball);
  console.log(`total: ${((performance.now() - totalStarted) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
