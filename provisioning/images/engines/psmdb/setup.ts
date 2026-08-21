import { parseArgs } from 'node:util';
import {
  configurePmm,
  docker,
  envFlag,
  PMM_CLIENT_OPTIONS,
  pmmClientConfig,
  preparePmm,
  requireDockerImage,
  registerPmmService,
  step,
  type PmmClientConfig,
  retry,
  waitForPmmExporter,
} from '../../../pmm-client.ts';

export type Version = '6.0' | '7.0' | '8.0';
export type SetupType = 'pss' | 'psa' | 'sharding';
export type StorageEngine = 'wiredTiger' | 'inMemory';
export type NodeRole = 'data' | 'arbiter' | 'config' | 'mongos';

export interface MongoNode {
  name: string;
  role: NodeRole;
  replicationSet?: string;
}

export interface Config extends PmmClientConfig {
  engine: 'psmdb' | 'mongodb';
  version: Version;
  image: string;
  setupType: SetupType;
  storageEngine: StorageEngine;
  clientTarball?: string;
  pmmServer?: string;
  tls: boolean;
  gssapi: boolean;
  replicaSets: number;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.engine=psmdb';
const MINIO_CONTAINER = 'psmdb-minio';
const MINIO_VOLUME = 'psmdb-minio-backups';
const KERBEROS = 'kerberos';
const KEYTABS_VOLUME = 'psmdb-keytabs';
const ROOT_USER = 'root';
const ROOT_PASSWORD = 'root';
const PMM_USER = 'pmm';
const PMM_PASSWORD = 'pmmpass';
const PBM_USER = 'pbm';
const PBM_PASSWORD = 'pbmpass';

function topologyLabel(setupType: SetupType): string {
  return `pmm-qa.psmdb.setup-type=${setupType}`;
}

function minioContainer(setupType: SetupType): string {
  return setupType === 'pss' ? MINIO_CONTAINER : `${MINIO_CONTAINER}-${setupType}`;
}

function minioVolume(setupType: SetupType): string {
  return setupType === 'pss' ? MINIO_VOLUME : `${MINIO_VOLUME}-${setupType}`;
}

export function normalizeVersion(value: string): Version {
  if (value === 'latest') return '8.0';
  if (!['6.0', '7.0', '8.0'].includes(value)) throw new Error('version must be 6.0, 7.0, or 8.0');
  return value;
}

export function normalizeSetupType(value: string): SetupType {
  const normalized = value.toLowerCase();
  if (normalized === 'pss' || normalized === 'psa') return normalized;
  if (normalized === 'shards' || normalized === 'sharding') return 'sharding';
  throw new Error('setup type must be pss, psa, shards, or sharding');
}

export function normalizeStorageEngine(value: string): StorageEngine {
  const normalized = value.toLowerCase();
  if (normalized === 'wiredtiger') return 'wiredTiger';
  if (normalized === 'inmemory') return 'inMemory';
  throw new Error('storage engine must be wiredTiger or inMemory');
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
      'storage-engine': { type: 'string' },
      ...PMM_CLIENT_OPTIONS,
      tls: { type: 'boolean' },
      gssapi: { type: 'boolean' },
      'replica-sets': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`Usage: node setup.ts [options]

  --version 6.0|7.0|8.0
  --setup-type pss|psa|shards|sharding
  --storage-engine wiredTiger|inMemory
  --replica-sets 1|2
  --client-version VERSION
  --client-tarball latest|PATH|URL
  --pmm-server HOST[:PORT]
  --admin-password PASSWORD
  --tls
  --gssapi
  --client-debug`);
    process.exit(0);
  }

  const composeProfile = (env.COMPOSE_PROFILES ?? 'classic').toLowerCase();
  if (!['classic', 'extra'].includes(composeProfile)) {
    throw new Error('COMPOSE_PROFILES must be classic or extra');
  }
  const engine = (values.engine ?? env.MONGO_ENGINE ?? 'psmdb').toLowerCase();
  if (engine !== 'psmdb' && engine !== 'mongodb') throw new Error('engine must be psmdb or mongodb');
  if (engine === 'psmdb' && env.OL_VERSION && !['8', '9'].includes(env.OL_VERSION)) {
    throw new Error('OL_VERSION must be 8 or 9');
  }
  const version = normalizeVersion(values.version ?? env.PSMDB_VERSION ?? env.MODB_VERSION ?? '8.0');
  const setupType = normalizeSetupType(values['setup-type'] ?? env.MONGO_SETUP_TYPE ?? 'pss');
  const storageEngine = normalizeStorageEngine(
    values['storage-engine'] ?? env.MONGO_STORAGE_ENGINE ?? 'wiredTiger',
  );
  if (setupType === 'sharding' && storageEngine === 'inMemory') {
    throw new Error('inMemory storage is only supported with pss or psa');
  }
  if (engine === 'mongodb' && storageEngine === 'inMemory') {
    throw new Error('MongoDB Community supports wiredTiger only');
  }
  const gssapi = values.gssapi ?? envFlag(env.GSSAPI);
  if (engine === 'mongodb' && gssapi) throw new Error('GSSAPI is supported by PSMDB only');
  const replicaSets = Number(values['replica-sets'] ?? env.REPLICA_SETS ?? (composeProfile === 'extra' ? '2' : '1'));
  if (![1, 2].includes(replicaSets)) throw new Error('replica sets must be 1 or 2');
  if (setupType === 'sharding' && replicaSets !== 1) {
    throw new Error('sharding already provisions two replica sets');
  }

  return {
    engine,
    version,
    image: values.image ?? env.PSMDB_IMAGE ?? env.MONGODB_IMAGE
      ?? `pmm-qa/${engine}:${version}${engine === 'psmdb' && env.OL_VERSION ? `-ol${env.OL_VERSION}` : ''}`,
    setupType,
    storageEngine,
    ...pmmClientConfig(values, {
      ...env,
      CLIENT_VERSION: env.PMM_CLIENT_VERSION ?? env.CLIENT_VERSION,
      PMM_SERVER_IP: env.PMM_SERVER_CONTAINER_ADDRESS ?? env.PMM_SERVER_IP,
      METRICS_MODE: env.METRICS_MODE ?? env.metrics_mode,
    }, '3-dev-latest'),
    tls: values.tls ?? envFlag(env.TLS),
    gssapi,
    replicaSets,
  };
}

export function topology(setupType: SetupType): MongoNode[] {
  const prefix = setupType === 'pss' ? '' : `${setupType}_`;
  if (setupType !== 'sharding') {
    return [1, 2, 3].map((number) => ({
      name: `${prefix}rs10${number}`,
      role: setupType === 'psa' && number === 3 ? 'arbiter' : 'data',
      replicationSet: 'rs',
    }));
  }
  return [
    ...['rs1', 'rs2'].flatMap((replicationSet, shard) =>
      [1, 2, 3].map((number) => ({
        name: `${prefix}rs${shard + 1}0${number}`,
        role: 'data' as const,
        replicationSet,
      })),
    ),
    ...[1, 2, 3].map((number) => ({
      name: `${prefix}rscfg0${number}`,
      role: 'config' as const,
      replicationSet: 'rscfg',
    })),
    { name: `${prefix}mongos`, role: 'mongos' as const },
  ];
}

export function configuredTopology(config: Config): MongoNode[] {
  const nodes = topology(config.setupType);
  const expanded = config.replicaSets === 1
    ? nodes
    : [1, 2].flatMap((set) => nodes.map((node) => ({
        ...node,
        name: node.name.replace('rs10', `rs${set}0`),
        replicationSet: `rs${set}`,
      })));
  return expanded.map((node) => ({
    ...node,
    name: config.engine === 'mongodb' ? `mongodb_${node.name}` : node.name,
  }));
}

function pushTlsAndGssapiArgs(args: string[], config: Pick<Config, 'tls' | 'gssapi'>, node: MongoNode): void {
  if (config.tls) {
    args.push(
      '--tlsMode=allowTLS',
      '--tlsCertificateKeyFile=/etc/mongodb.pem',
      '--tlsCAFile=/etc/mongodb-ca.crt',
      '--tlsAllowConnectionsWithoutCertificates',
    );
  }
  if (config.gssapi) {
    args.push('--setParameter=authenticationMechanisms=SCRAM-SHA-1,SCRAM-SHA-256,GSSAPI', `--setParameter=saslHostName=${node.name}`);
  }
}

export function mongodArguments(config: Config, node: MongoNode): string[] {
  if (node.role === 'mongos') {
    const args = [
      'mongos',
      '--bind_ip_all',
      '--port=27017',
      '--keyFile=/etc/mongodb-keyfile',
      `--configdb=rscfg/${configuredTopology(config)
        .filter((candidate) => candidate.role === 'config')
        .map((candidate) => `${candidate.name}:27017`)
        .join(',')}`,
    ];
    pushTlsAndGssapiArgs(args, config, node);
    return args;
  }

  const args = [
    'mongod',
    '--bind_ip_all',
    '--port=27017',
    '--dbpath=/data/db',
    `--replSet=${node.replicationSet}`,
    '--keyFile=/etc/mongodb-keyfile',
    '--auth',
    '--profile=2',
    '--slowms=1',
  ];
  if (config.setupType === 'sharding') {
    args.push(node.role === 'config' ? '--configsvr' : '--shardsvr');
  }
  if (config.storageEngine === 'inMemory') {
    args.push('--storageEngine=inMemory', '--inMemorySizeGB=1');
  }
  pushTlsAndGssapiArgs(args, config, node);
  return args;
}

async function cleanup(config: Config): Promise<void> {
  const containers = configuredTopology(config).map(({ name }) => name);
  if (config.engine === 'psmdb') containers.push(minioContainer(config.setupType));
  if (config.gssapi) containers.push(KERBEROS);
  await docker(['rm', '-fv', ...containers], true);
  if (config.engine === 'psmdb') {
    await docker(['volume', 'rm', '-f', minioVolume(config.setupType)], true);
  }
  if (config.gssapi) await docker(['volume', 'rm', '-f', KEYTABS_VOLUME], true);
}

async function startContainer(config: Config, node: MongoNode): Promise<void> {
  const args = [
    'run',
    '--detach',
    '--name',
    node.name,
    '--hostname',
    node.name,
    '--label',
    LABEL,
    '--label',
    topologyLabel(config.setupType),
    '--network',
    NETWORK,
  ];
  if (config.gssapi) {
    args.push('--env', 'KRB5_KTNAME=/keytabs/mongodb.keytab', '--volume', `${KEYTABS_VOLUME}:/keytabs:ro`);
  }
  if (node.name === 'rs101') args.push('--publish', '27027:27017');
  args.push(config.image, ...mongodArguments(config, node));
  await docker(args);
}

async function mongo(
  container: string,
  javascript: string,
  authenticated = true,
  allowFailure = false,
) {
  const args = ['exec', container, 'mongosh', '--quiet', '--host=127.0.0.1', '--port=27017'];
  if (authenticated) {
    args.push(
      `--username=${ROOT_USER}`,
      `--password=${ROOT_PASSWORD}`,
      '--authenticationDatabase=admin',
    );
  }
  args.push('--eval', javascript);
  return docker(args, allowFailure);
}

async function waitForMongo(name: string, authenticated = false): Promise<void> {
  await retry(
    `${name} MongoDB`,
    () => mongo(name, 'db.adminCommand({ping: 1}).ok', authenticated, true),
    (result) => result.stdout.trim().endsWith('1'),
  );
}

function replicaSetConfig(nodes: MongoNode[]): string {
  return JSON.stringify({
    _id: nodes[0].replicationSet,
    members: nodes.map((node, index) => ({
      _id: index,
      host: `${node.name}:27017`,
      ...(node.role === 'arbiter' ? { arbiterOnly: true } : { priority: index === 0 ? 2 : 1 }),
    })),
  });
}

const CREATE_USERS = `
db = db.getSiblingDB("admin");
db.createRole({
  role: "pbmAnyAction",
  privileges: [{ resource: { anyResource: true }, actions: ["anyAction"] }],
  roles: []
});
db.createRole({
  role: "explainRole",
  privileges: [{
    resource: { db: "", collection: "" },
    actions: ["listIndexes", "listCollections", "dbStats", "dbHash", "collStats", "find"]
  }],
  roles: []
});
db.createUser({
  user: "${PBM_USER}",
  pwd: "${PBM_PASSWORD}",
  roles: ["readWrite", "backup", "clusterMonitor", "restore", "pbmAnyAction"]
});
db.createUser({
  user: "${PMM_USER}",
  pwd: "${PMM_PASSWORD}",
  roles: [
    "explainRole", "clusterMonitor", "readWrite", "backup", "restore",
    { role: "read", db: "local" }, "pbmAnyAction"
  ]
});`;

async function configureReplicaSet(config: Config, nodes: MongoNode[]): Promise<void> {
  const primary = nodes[0].name;
  await mongo(primary, `rs.initiate(${replicaSetConfig(nodes)})`, false);
  await retry(
    `${nodes[0].replicationSet} primary`,
    () => mongo(primary, 'db.hello().isWritablePrimary', false, true),
    (result) => result.stdout.includes('true'),
  );
  await mongo(
    primary,
    `db.getSiblingDB("admin").createUser({
      user: "${ROOT_USER}", pwd: "${ROOT_PASSWORD}",
      roles: ["root", "userAdminAnyDatabase", "clusterAdmin"]
    })`,
    false,
  );
  await mongo(primary, CREATE_USERS);
  if (config.gssapi) {
    await mongo(primary, `db.getSiblingDB("$external").createUser({
      user: "pmm@PERCONATEST.COM",
      roles: [
        { role: "explainRole", db: "admin" }, { role: "clusterMonitor", db: "admin" },
        { role: "read", db: "local" }, { role: "readWrite", db: "admin" },
        { role: "backup", db: "admin" }, { role: "restore", db: "admin" },
        { role: "pbmAnyAction", db: "admin" }
      ]
    })`);
  }
}

async function startKerberos(config: Config): Promise<void> {
  if (!config.gssapi) return;
  const hosts = configuredTopology(config).map(({ name }) => name).join(' ');
  await requireDockerImage('pmm-qa/kerberos:latest', 'npm run build -- psmdb');
  await docker(['volume', 'create', KEYTABS_VOLUME]);
  await docker(['run', '--detach', '--name', KERBEROS, '--hostname', KERBEROS,
    '--label', LABEL, '--network', NETWORK, '--volume', `${KEYTABS_VOLUME}:/keytabs`,
    '--env', `MONGO_HOSTS=${hosts}`, 'pmm-qa/kerberos:latest']);
  await retry('Kerberos keytab', () => docker(['exec', KERBEROS, 'sh', '-c', 'test -s /keytabs/mongodb.keytab && echo ready'], true), (result) => result.stdout.includes('ready'));
}

async function startTopology(config: Config): Promise<MongoNode[]> {
  const nodes = configuredTopology(config);
  const mongoNodes = nodes.filter((node) => node.role !== 'mongos');
  await Promise.all(mongoNodes.map((node) => startContainer(config, node)));
  await Promise.all(mongoNodes.map((node) => waitForMongo(node.name)));

  const replicaSets = Map.groupBy(mongoNodes, (node) => node.replicationSet!);
  for (const members of replicaSets.values()) await configureReplicaSet(config, members);

  const mongos = nodes.find((node) => node.role === 'mongos');
  if (mongos) {
    await startContainer(config, mongos);
    await waitForMongo(mongos.name, true);
    for (const replicationSet of ['rs1', 'rs2']) {
      const members = mongoNodes
        .filter((node) => node.replicationSet === replicationSet)
        .map((node) => `${node.name}:27017`)
        .join(',');
      await mongo(mongos.name, `sh.addShard("${replicationSet}/${members}")`);
    }
    await retry(
      'two MongoDB shards',
      () => mongo(mongos.name, 'db.adminCommand({listShards: 1}).shards.length', true, true),
      (result) => result.stdout.trim().endsWith('2'),
    );
  }
  return nodes;
}

async function startMinio(config: Config): Promise<void> {
  const container = minioContainer(config.setupType);
  const volume = minioVolume(config.setupType);
  await docker(['volume', 'create', volume]);
  await docker([
    'run',
    '--detach',
    '--name',
    container,
    '--label',
    LABEL,
    '--label',
    topologyLabel(config.setupType),
    '--network',
    NETWORK,
    '--volume',
    `${volume}:/data`,
    '--env',
    'MINIO_ROOT_USER=minio1234',
    '--env',
    'MINIO_ROOT_PASSWORD=minio1234',
    ...(config.setupType === 'pss' ? ['--publish', '9010:9000', '--publish', '9001:9001'] : []),
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
          'run',
          '--rm',
          '--network',
          NETWORK,
          'minio/mc',
          'alias',
          'set',
          'local',
          `http://${container}:9000`,
          'minio1234',
          'minio1234',
        ],
        true,
      ),
    (result) => !result.stderr.includes('Unable to initialize'),
  );
  await docker([
    'run',
    '--rm',
    '--network',
    NETWORK,
    '--entrypoint',
    '/bin/sh',
    'minio/mc',
    '-ceu',
    `mc alias set local http://${container}:9000 minio1234 minio1234
     mc mb --ignore-existing local/bcp`,
  ]);
}

function mongodbUri(host: string, user: string, password: string): string {
  return `mongodb://${user}:${password}@${host}:27017/?authSource=admin`;
}

async function configurePbm(config: Config, nodes: MongoNode[]): Promise<void> {
  const agentNodes = nodes.filter((node) => node.role === 'data' || node.role === 'config');
  await Promise.all(
    agentNodes.map((node) =>
      docker([
        'exec',
        '--detach',
        '--env',
        `PBM_MONGODB_URI=${mongodbUri('127.0.0.1', PBM_USER, PBM_PASSWORD)}`,
        node.name,
        'pbm-agent',
      ]),
    ),
  );

  const control = nodes.find((node) => node.role === 'mongos')?.name ?? nodes[0].name;
  const pbmConfig = `storage:
  type: s3
  s3:
    region: us-east-1
    bucket: bcp
    endpointUrl: http://${minioContainer(config.setupType)}:9000
    credentials:
      access-key-id: minio1234
      secret-access-key: minio1234
    prefix: pbme2etest`;
  await docker([
    'exec',
    '--env',
    `PBM_MONGODB_URI=${mongodbUri('127.0.0.1', PBM_USER, PBM_PASSWORD)}`,
    control,
    'sh',
    '-ceu',
    `printf '%s\n' "$1" > /tmp/pbm-config.yaml
     pbm config --file /tmp/pbm-config.yaml`,
    'sh',
    pbmConfig,
  ]);
}

async function registerWithPmm(config: Config, nodes: MongoNode[]): Promise<void> {
  const suffix = String(Date.now()).slice(-5);
  await Promise.all(
    nodes.map((node) => {
      const args = [
        'exec',
        node.name,
        'pmm-admin',
        'add',
        'mongodb',
        '--enable-all-collectors',
        '--agent-password=mypass',
        `--environment=${config.setupType === 'sharding' ? 'mongo-sharded-dev' : `${config.engine}-dev`}`,
        `--cluster=${config.setupType === 'sharding' ? 'sharded' : 'replicaset'}`,
        '--host=127.0.0.1',
        '--port=27017',
      ];
      if (node.role !== 'arbiter') {
        if (config.gssapi) {
          args.push('--username=pmm@PERCONATEST.COM', '--password=password1',
            '--authentication-mechanism=GSSAPI', '--authentication-database=$external');
        } else {
          args.push(`--username=${PMM_USER}`, `--password=${PMM_PASSWORD}`);
        }
      }
      if (config.tls) args.push('--tls', '--tls-skip-verify');
      if (node.replicationSet) args.push(`--replication-set=${node.replicationSet}`);
      args.push(`${node.name}_${suffix}`);
      return registerPmmService(args);
    }),
  );
  await Promise.all(nodes.map((node) => waitForPmmExporter(node.name, 'mongodb_exporter')));
}

async function seedWorkload(config: Config, nodes: MongoNode[]): Promise<void> {
  const target =
    nodes.find((node) => node.role === 'mongos')?.name ??
    nodes.find((node) => node.role === 'data')!.name;
  const dataFile =
    config.setupType === 'sharding'
      ? '/usr/share/pmm-qa/datagen/sharded.json'
      : '/usr/share/pmm-qa/datagen/replicaset.json';
  await docker([
    'exec',
    target,
    'mgodatagen',
    '-f',
    dataFile,
    `--uri=${mongodbUri('127.0.0.1', ROOT_USER, ROOT_PASSWORD)}`,
  ]);
}

async function main(): Promise<void> {
  const started = performance.now();
  const config = parseConfig();
  await step('Check Docker', () => docker(['info']));
  const [pmmServer, tarball] = await preparePmm(config, config.image, 'npm run build -- <version>');
  await step('Clean previous run', () => cleanup(config));
  await step('Start Kerberos', () => startKerberos(config));
  const nodes = await step(`Start and configure ${config.engine} topology`, () => startTopology(config));
  if (config.engine === 'psmdb') {
    await step('Start MinIO', () => startMinio(config));
    await step('Configure PBM', () => configurePbm(config, nodes));
  }
  const names = nodes.map((node) => node.name);
  await configurePmm(config, names, pmmServer, tarball);
  await step(`Register ${config.engine} with PMM`, () => registerWithPmm(config, nodes));
  await step('Seed workload', () => seedWorkload(config, nodes));
  console.log(`total: ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
