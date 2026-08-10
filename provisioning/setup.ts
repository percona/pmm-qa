import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveClientTarball } from './pmm-client.ts';
import { containerName as mysqlContainerName } from './prebaked-poc/setup.ts';
import { containerName as pxcContainerName } from './prebaked-poc/engines/pxc/setup.ts';
import { MINIMUM_NODES } from './prebaked-poc/lib/engines.ts';

export type DatabaseType = 'mysql' | 'ps' | 'pxc' | 'psmdb' | 'mongodb' | 'pgsql' | 'pdpgsql' | 'valkey' | 'haproxy' | 'external' | 'bucket';

export interface DatabaseConfig {
  type: DatabaseType;
  version: string;
  options: Record<string, string>;
}

export interface Config {
  databases: DatabaseConfig[];
  serverImage: string;
  pmmServer?: string;
  adminPassword: string;
  clientVersion: string;
  metricsMode: string;
  clientDebug: boolean;
  encryptedClientConfig: boolean;
  teardown: boolean;
  help: boolean;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type Runner = (
  file: string,
  args: string[],
  allowFailure?: boolean,
  quiet?: boolean,
) => Promise<CommandResult>;

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const NETWORK = 'pmm-qa';
const SERVER = 'pmm-server';
const TEARDOWN_LABELS = ['pmm-qa.orchestrator=server', 'pmm-qa.poc'];
const TEARDOWN_VOLUME_PREFIXES = ['pmm-qa-', 'psmdb-poc-'];
const SERVER_VOLUME = 'pmm-qa-pmm-server-data';
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export const DATABASES = {
  mysql: {
    versions: ['5.7', '8.0', '8.4', '9.7'],
    defaultVersion: '8.4',
    defaults: { 'setup-type': 'single', 'query-source': 'perfschema' },
    options: new Set(['setup-type', 'nodes', 'query-source', 'workload-seconds', 'skip-workload', 'tls']),
  },
  ps: {
    versions: ['5.7', '8.0', '8.4'],
    defaultVersion: '8.4',
    defaults: { 'setup-type': 'single', 'query-source': 'perfschema' },
    options: new Set([
      'setup-type',
      'nodes',
      'query-source',
      'workload-seconds',
      'skip-workload',
      'my-rocks',
      'backup',
      'buckets',
      'tls',
    ]),
  },
  pxc: {
    versions: ['5.7', '8.0'],
    defaultVersion: '8.0',
    defaults: { 'setup-type': 'cluster', 'query-source': 'perfschema' },
    options: new Set(['setup-type', 'nodes', 'query-source', 'workload-seconds', 'skip-workload']),
  },
  psmdb: {
    versions: ['6.0', '7.0', '8.0', 'latest'],
    defaultVersion: '8.0',
    defaults: { 'setup-type': 'pss', 'storage-engine': 'wiredTiger' },
    options: new Set(['setup-type', 'storage-engine', 'replica-sets', 'compose-profiles', 'ol-version', 'tls', 'gssapi']),
  },
  mongodb: {
    versions: ['6.0', '7.0', '8.0'],
    defaultVersion: '8.0',
    defaults: { 'setup-type': 'pss', 'storage-engine': 'wiredTiger' },
    options: new Set(['setup-type', 'tls']),
  },
  pgsql: {
    versions: ['16', '17', '18'],
    defaultVersion: '18',
    defaults: { 'setup-type': 'single' },
    options: new Set(['setup-type', 'nodes', 'tls']),
  },
  pdpgsql: {
    versions: ['16', '17', '18'],
    defaultVersion: '18',
    defaults: { 'setup-type': 'single' },
    options: new Set(['setup-type', 'nodes', 'tls']),
  },
  valkey: {
    versions: ['7', '8'],
    defaultVersion: '8',
    defaults: { 'setup-type': 'cluster' },
    options: new Set(['setup-type']),
  },
  haproxy: {
    versions: ['latest'],
    defaultVersion: 'latest',
    defaults: { 'setup-type': 'single' },
    options: new Set<string>(),
  },
  external: {
    versions: ['latest'],
    defaultVersion: 'latest',
    defaults: { 'setup-type': 'single' },
    options: new Set<string>(),
  },
  bucket: {
    versions: ['latest'],
    defaultVersion: 'latest',
    defaults: { 'setup-type': 'single', buckets: 'bcp' },
    options: new Set(['buckets']),
  },
} as const;

const HELP = `Usage: node provisioning/setup.ts [--db DESCRIPTOR] [--db DESCRIPTOR] [options]

  --db mysql=VERSION,setup-type=single|replication|gr,query-source=perfschema|slowlog
  --db ps=VERSION,setup-type=single|replication|gr,query-source=perfschema|slowlog
  --db pxc=VERSION,nodes=NUMBER,query-source=perfschema|slowlog
  --db psmdb=VERSION,setup-type=pss|psa|sharding,storage-engine=wiredTiger|inMemory,replica-sets=1|2,ol-version=8|9
  --db mongodb=VERSION,setup-type=pss|psa|sharding
  --db pgsql=VERSION,setup-type=single|replication,nodes=NUMBER
  --db pdpgsql=VERSION,setup-type=single|replication|patroni,nodes=NUMBER
  --db valkey=VERSION,setup-type=cluster|sentinel
  --db haproxy
  --db external
  --db bucket,buckets=bcp;archive
  --server-image IMAGE       default: perconalab/pmm-server:3-dev-latest
  --pmm-server HOST[:PORT]   use an existing PMM Server
  --admin-password PASSWORD  default: admin
  --client-version VERSION   version or tarball URL (default: latest-tarball)
  --metrics-mode MODE        PMM metrics mode (default: auto)
  --client-debug
  --encrypted-client-config
  --teardown                 remove all pmm-qa provisioned containers, volumes, and network
  --help

PS also accepts nodes, workload-seconds, skip-workload, my-rocks, backup, and buckets.
MYSQL, PS, PSMDB, MongoDB, PGSQL, and PDPGSQL accept tls=true; ssl_NAME aliases enable it.
Repeat --db to provision multiple database types or distinct topologies.
Omit --db to provision PMM Server only.
--teardown ignores --db and removes everything this script previously provisioned.`;

function boolean(value: string, name: string): boolean {
  const normalized = value.toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be true or false`);
}

export function parseDatabase(value: string): DatabaseConfig {
  const [head, ...entries] = value.split(',');
  const separator = head.indexOf('=');
  const requestedType = (separator === -1 ? head : head.slice(0, separator)).toLowerCase().replaceAll('_', '-');
  const tlsAlias = requestedType.startsWith('ssl-');
  const type = tlsAlias ? requestedType.slice(4) : requestedType;
  if (!['mysql', 'ps', 'pxc', 'psmdb', 'mongodb', 'pgsql', 'pdpgsql', 'valkey', 'haproxy', 'external', 'bucket'].includes(type)) {
    throw new Error('unknown provisioning type');
  }

  const databaseType = type as DatabaseType;
  const metadata = DATABASES[databaseType];
  const requestedVersion = separator === -1 ? metadata.defaultVersion : head.slice(separator + 1);
  if (!metadata.versions.includes(requestedVersion as never)) {
    throw new Error(`${type} version must be ${metadata.versions.join(', ')}`);
  }
  const version = type === 'psmdb' && requestedVersion === 'latest' ? '8.0' : requestedVersion;

  const options: Record<string, string> = { ...metadata.defaults, ...(tlsAlias ? { tls: 'true' } : {}) };
  for (const entry of entries) {
    const equals = entry.indexOf('=');
    if (equals < 1 || equals === entry.length - 1) {
      throw new Error(`invalid ${type} option: ${entry}`);
    }
    const key = entry.slice(0, equals).toLowerCase();
    const optionValue = entry.slice(equals + 1);
    if (!metadata.options.has(key as never)) throw new Error(`${key} is not supported for ${type}`);
    options[key] = optionValue;
  }

  if (type === 'mysql' || type === 'ps') {
    if (!['single', 'replication', 'gr'].includes(options['setup-type'])) {
      throw new Error(`${type.toUpperCase()} setup-type must be single, replication, or gr`);
    }
    if (!['perfschema', 'slowlog'].includes(options['query-source'])) {
      throw new Error('PS query-source must be perfschema or slowlog');
    }
    for (const key of ['nodes', 'workload-seconds']) {
      if (options[key] && (!Number.isInteger(Number(options[key])) || Number(options[key]) < 1)) {
        throw new Error(`${key} must be a positive integer`);
      }
    }
    for (const key of ['skip-workload', 'my-rocks', 'backup', 'tls']) {
      if (options[key]) boolean(options[key], key);
    }
  } else if (type === 'pxc') {
    if (options['setup-type'] !== 'cluster') throw new Error('PXC setup-type must be cluster');
    if (!['perfschema', 'slowlog'].includes(options['query-source'])) {
      throw new Error('PXC query-source must be perfschema or slowlog');
    }
    for (const key of ['nodes', 'workload-seconds']) {
      if (options[key] && (!Number.isInteger(Number(options[key])) || Number(options[key]) < 1)) {
        throw new Error(`${key} must be a positive integer`);
      }
    }
    if (options.nodes && Number(options.nodes) < 3) throw new Error('PXC requires at least 3 nodes');
    if (options['skip-workload']) boolean(options['skip-workload'], 'skip-workload');
  } else if (type === 'psmdb' || type === 'mongodb') {
    if (options.tls) boolean(options.tls, 'tls');
    if (options.gssapi) boolean(options.gssapi, 'gssapi');
    if (!['pss', 'psa', 'shards', 'sharding'].includes(options['setup-type'])) {
      throw new Error('PSMDB setup-type must be pss, psa, or sharding');
    }
    if (!['wiredtiger', 'inmemory'].includes(options['storage-engine'].toLowerCase())) {
      throw new Error('PSMDB storage-engine must be wiredTiger or inMemory');
    }
    if (type === 'mongodb' && options['storage-engine'].toLowerCase() === 'inmemory') {
      throw new Error('MongoDB Community supports wiredTiger only');
    }
    if (options['compose-profiles'] && !['classic', 'extra'].includes(options['compose-profiles'].toLowerCase())) {
      throw new Error('compose-profiles must be classic or extra');
    }
    if (options['compose-profiles']) {
      const profileReplicaSets = options['compose-profiles'].toLowerCase() === 'extra' ? '2' : '1';
      if (options['replica-sets'] && options['replica-sets'] !== profileReplicaSets) {
        throw new Error('compose-profiles conflicts with replica-sets');
      }
      options['replica-sets'] = profileReplicaSets;
    }
    if (options['replica-sets'] && !['1', '2'].includes(options['replica-sets'])) {
      throw new Error('replica-sets must be 1 or 2');
    }
    if (options['replica-sets'] === '2' && options['setup-type'] === 'sharding') {
      throw new Error('sharding already provisions two replica sets');
    }
    if (options['ol-version'] && !['8', '9'].includes(options['ol-version'])) {
      throw new Error('ol-version must be 8 or 9');
    }
  } else if (type === 'pgsql') {
    if (options.tls) boolean(options.tls, 'tls');
    if (!['single', 'replication'].includes(options['setup-type'])) {
      throw new Error('PGSQL setup-type must be single or replication');
    }
    if (options.nodes && (!Number.isInteger(Number(options.nodes)) || Number(options.nodes) < 1)) {
      throw new Error('nodes must be a positive integer');
    }
    if (options['setup-type'] === 'single' && options.nodes && options.nodes !== '1') {
      throw new Error('PGSQL single requires exactly 1 node');
    }
    if (options['setup-type'] === 'replication' && options.nodes && Number(options.nodes) < 2) {
      throw new Error('PGSQL replication requires at least 2 nodes');
    }
  } else if (type === 'pdpgsql') {
    if (options.tls) boolean(options.tls, 'tls');
    if (!['single', 'replication', 'patroni'].includes(options['setup-type'])) {
      throw new Error('PDPGSQL setup-type must be single, replication, or patroni');
    }
    if (options.nodes && (!Number.isInteger(Number(options.nodes)) || Number(options.nodes) < 1)) {
      throw new Error('nodes must be a positive integer');
    }
    const minimum = options['setup-type'] === 'patroni' ? 3 : options['setup-type'] === 'replication' ? 2 : 1;
    if (options.nodes && Number(options.nodes) < minimum) {
      throw new Error(`PDPGSQL ${options['setup-type']} requires at least ${minimum} nodes`);
    }
    if (options['setup-type'] === 'single' && options.nodes && options.nodes !== '1') {
      throw new Error('PDPGSQL single requires exactly 1 node');
    }
  } else if (type === 'valkey') {
    if (options['setup-type'] === 'sentinels') options['setup-type'] = 'sentinel';
    if (!['cluster', 'sentinel'].includes(options['setup-type'])) {
      throw new Error('Valkey setup-type must be cluster or sentinel');
    }
  }

  return { type: databaseType, version, options };
}

export function parseConfig(argv: string[] = process.argv.slice(2)): Config {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      db: { type: 'string', multiple: true },
      'server-image': { type: 'string' },
      'pmm-server': { type: 'string' },
      'admin-password': { type: 'string' },
      'client-version': { type: 'string' },
      'metrics-mode': { type: 'string' },
      'client-debug': { type: 'boolean' },
      'encrypted-client-config': { type: 'boolean' },
      teardown: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const help = values.help ?? false;
  const teardown = values.teardown ?? false;
  const databases = (values.db ?? []).map(parseDatabase);
  const databaseKeys = databases.map(
    ({ type, options }) => `${type}:${options['setup-type']}`,
  );
  if (new Set(databaseKeys).size !== databaseKeys.length) {
    throw new Error('each database topology may be provided only once');
  }
  const clientVersion = values['client-version'] ?? 'latest-tarball';
  if (
    !['3-dev-latest', 'pmm3-rc', 'pmm3-latest', 'latest-tarball'].includes(clientVersion) &&
    !/^3\.\d+\.\d+$/.test(clientVersion) &&
    !/^https?:\/\//i.test(clientVersion)
  ) {
    throw new Error(
      'client version must be 3-dev-latest, pmm3-rc, pmm3-latest, 3.x.y, latest-tarball, or a tarball URL',
    );
  }
  return {
    databases,
    serverImage: values['server-image'] ?? 'perconalab/pmm-server:3-dev-latest',
    pmmServer: values['pmm-server'],
    adminPassword: values['admin-password'] ?? 'admin',
    clientVersion,
    metricsMode: values['metrics-mode'] ?? 'auto',
    clientDebug: values['client-debug'] ?? false,
    encryptedClientConfig: values['encrypted-client-config'] ?? false,
    teardown,
    help,
  };
}

export function databaseImage(database: DatabaseConfig): string {
  const os = database.type === 'psmdb' && database.options['ol-version']
    ? `-ol${database.options['ol-version']}`
    : '';
  return `pmm-qa/${database.type}:${database.version}${os}-prebaked`;
}

export function databaseArchive(database: DatabaseConfig): string {
  const os = database.type === 'psmdb' && database.options['ol-version']
    ? `-ol${database.options['ol-version']}`
    : '';
  return resolve(ROOT, 'images', `${database.type}${database.version}${os}.tar.gz`);
}

// HAProxy's `haproxy` --db target has no database of its own to front; when PS/PXC are
// requested alongside it in the same run, point it at their real containers on :3306 so it acts
// as a genuine load balancer (see engines/services/setup.ts's `--backends`) instead of a
// metrics-only stub.
export function backendTargets(databases: DatabaseConfig[]): string[] {
  const targets: string[] = [];
  for (const database of databases) {
    if (database.type === 'ps') {
      const setupType = (database.options['setup-type'] ?? 'single') as 'single' | 'replication' | 'gr';
      const nodes = Number(database.options.nodes ?? MINIMUM_NODES[setupType]);
      for (let node = 1; node <= nodes; node += 1) {
        targets.push(`${mysqlContainerName({ engine: database.type, setupType, version: database.version as never }, node)}:3306`);
      }
    } else if (database.type === 'pxc') {
      const nodes = Number(database.options.nodes ?? 3);
      for (let node = 1; node <= nodes; node += 1) {
        targets.push(`${pxcContainerName(node)}:3306`);
      }
    }
  }
  return targets;
}

function addValue(args: string[], options: Record<string, string>, key: string): void {
  if (options[key] !== undefined) args.push(`--${key}`, options[key]);
}

function addBoolean(args: string[], options: Record<string, string>, key: string): void {
  if (options[key] !== undefined && boolean(options[key], key)) args.push(`--${key}`);
}

export function provisionerArgs(
  database: DatabaseConfig,
  clientArgs: string[],
  adminPassword = 'admin',
  clientDebug = false,
  encryptedClientConfig = false,
  pmmServer = SERVER,
  metricsMode = 'auto',
  allDatabases: DatabaseConfig[] = [],
): string[] {
  const image = databaseImage(database);
  const sharedClientArgs = [
    ...clientArgs,
    ...(clientDebug ? ['--client-debug'] : []),
    ...(encryptedClientConfig ? ['--encrypted-client-config'] : []),
    '--metrics-mode',
    metricsMode,
  ];
  if (database.type === 'mysql' || database.type === 'ps') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'setup.ts'),
      '--engine',
      database.type,
      '--version',
      database.version,
      '--image',
      image,
      '--pmm-server',
      pmmServer,
      '--admin-password',
      adminPassword,
      ...sharedClientArgs,
    ];
    for (const key of ['setup-type', 'nodes', 'query-source', 'workload-seconds', 'buckets']) {
      addValue(args, database.options, key);
    }
    for (const key of ['skip-workload', 'my-rocks', 'backup', 'tls']) {
      addBoolean(args, database.options, key);
    }
    return args;
  }

  if (database.type === 'pxc') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'engines', 'pxc', 'setup.ts'),
      '--version',
      database.version,
      '--image',
      image,
    '--pmm-server',
    pmmServer,
      '--admin-password',
      adminPassword,
      ...sharedClientArgs,
    ];
    for (const key of ['nodes', 'query-source', 'workload-seconds']) {
      addValue(args, database.options, key);
    }
    addBoolean(args, database.options, 'skip-workload');
    return args;
  }

  if (database.type === 'psmdb' || database.type === 'mongodb') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'engines', 'psmdb', 'setup.ts'),
      '--engine',
      database.type,
      '--version',
      database.version,
      '--image',
      image,
      '--pmm-server',
      pmmServer,
      '--admin-password',
      adminPassword,
      ...sharedClientArgs,
    ];
    addValue(args, database.options, 'setup-type');
    addValue(args, database.options, 'storage-engine');
    addValue(args, database.options, 'replica-sets');
    addBoolean(args, database.options, 'tls');
    addBoolean(args, database.options, 'gssapi');
    return args;
  }

  if (database.type === 'pgsql') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'engines', 'pgsql', 'setup.ts'),
      '--version', database.version, '--image', image, '--pmm-server', pmmServer,
      '--admin-password', adminPassword, ...sharedClientArgs,
    ];
    addValue(args, database.options, 'setup-type');
    addValue(args, database.options, 'nodes');
    addBoolean(args, database.options, 'tls');
    return args;
  }

  if (database.type === 'valkey') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'engines', 'valkey', 'setup.ts'),
      '--version', database.version, '--image', image, '--pmm-server', pmmServer,
      '--admin-password', adminPassword, ...sharedClientArgs,
    ];
    addValue(args, database.options, 'setup-type');
    return args;
  }

  if (database.type === 'haproxy' || database.type === 'external') {
    const args = [
      resolve(ROOT, 'prebaked-poc', 'engines', 'services', 'setup.ts'),
      '--type', database.type, '--image', image, '--pmm-server', pmmServer,
      '--admin-password', adminPassword, ...sharedClientArgs,
    ];
    if (database.type === 'haproxy') {
      const targets = backendTargets(allDatabases.filter((sibling) => sibling !== database));
      if (targets.length) args.push('--backends', targets.join(','));
    }
    return args;
  }

  if (database.type === 'bucket') {
    const args = [resolve(ROOT, 'prebaked-poc', 'engines', 'minio', 'setup.ts'), '--image', image];
    addValue(args, database.options, 'buckets');
    return args;
  }

  const args = [
    resolve(ROOT, 'prebaked-poc', 'engines', 'pdpgsql', 'setup.ts'),
    '--version',
    database.version,
    '--image',
    image,
      '--pmm-server',
      pmmServer,
    '--admin-password',
    adminPassword,
    ...sharedClientArgs,
  ];
  addValue(args, database.options, 'setup-type');
  addValue(args, database.options, 'nodes');
  addBoolean(args, database.options, 'tls');
  return args;
}

export const runCommand: Runner = (file, args, allowFailure = false, quiet = false) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
      if (!quiet) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk);
      if (!quiet) process.stderr.write(chunk);
    });
    child.on('error', rejectCommand);
    child.on('close', (code) => {
      const result = {
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      };
      if (result.code !== 0 && !allowFailure) {
        rejectCommand(new Error(`${file} ${args.join(' ')} failed\n${result.stderr}`.trim()));
      } else {
        resolveCommand(result);
      }
    });
  });

async function step<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  console.log(`\n==> ${name}`);
  try {
    const result = await operation();
    console.log(`<== ${name} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
    return result;
  } catch (error) {
    console.error(`<!! ${name} failed (${((performance.now() - started) / 1000).toFixed(1)}s)`);
    throw error;
  }
}

export async function ensureDocker(runner: Runner): Promise<void> {
  if ((await runner('docker', ['info'], true, true)).code !== 0) {
    throw new Error('Docker is not running');
  }
}

export async function teardownContainerIds(runner: Runner): Promise<string[]> {
  const idLists = await Promise.all(
    TEARDOWN_LABELS.map((label) => runner('docker', ['ps', '-aq', '--filter', `label=${label}`], true, true)),
  );
  return [...new Set(idLists.flatMap((result) => result.stdout.trim().split(/\s+/).filter(Boolean)))];
}

export async function teardownVolumeNames(runner: Runner): Promise<string[]> {
  const nameLists = await Promise.all(
    TEARDOWN_VOLUME_PREFIXES.map((prefix) => runner('docker', ['volume', 'ls', '-q', '--filter', `name=${prefix}`], true, true)),
  );
  return [...new Set(nameLists.flatMap((result) => result.stdout.trim().split(/\s+/).filter(Boolean)))];
}

export async function teardown(runner: Runner = runCommand): Promise<void> {
  await ensureDocker(runner);
  const containerIds = await teardownContainerIds(runner);
  if (containerIds.length) await runner('docker', ['rm', '-fv', ...containerIds]);
  const volumeNames = await teardownVolumeNames(runner);
  if (volumeNames.length) await runner('docker', ['volume', 'rm', '-f', ...volumeNames], true);
  await runner('docker', ['network', 'rm', NETWORK], true);
}

async function ensureNetwork(runner: Runner): Promise<void> {
  if ((await runner('docker', ['network', 'inspect', NETWORK], true, true)).code !== 0) {
    await runner('docker', ['network', 'create', NETWORK]);
  }
}

export async function startServer(
  config: Pick<Config, 'serverImage' | 'adminPassword'>,
  runner: Runner,
  pause: (milliseconds: number) => Promise<unknown> = sleep,
): Promise<void> {
  await runner('docker', ['rm', '-f', SERVER], true);
  await runner('docker', ['volume', 'rm', '-f', SERVER_VOLUME], true);
  await ensureNetwork(runner);
  await runner('docker', ['pull', config.serverImage]);
  await runner('docker', ['volume', 'create', SERVER_VOLUME]);
  await runner('docker', [
    'run',
    '--detach',
    '--name',
    SERVER,
    '--label',
    'pmm-qa.orchestrator=server',
    '--network',
    NETWORK,
    '--publish',
    '443:8443',
    '--env',
    'PMM_ENABLE_TELEMETRY=0',
    '--env',
    'GF_SECURITY_ADMIN_USER=admin',
    '--env',
    `GF_SECURITY_ADMIN_PASSWORD=${config.adminPassword}`,
    '--volume',
    `${SERVER_VOLUME}:/srv`,
    config.serverImage,
  ]);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await runner(
      'docker',
      ['exec', SERVER, 'curl', '-f', 'http://127.0.0.1:8080/v1/server/readyz'],
      true,
      true,
    );
    if (result.code === 0) return;
    await pause(1000);
  }
  throw new Error('timed out after 120 seconds waiting for PMM Server');
}

async function ensureDatabaseImage(database: DatabaseConfig, runner: Runner): Promise<void> {
  const image = databaseImage(database);
  if ((await runner('docker', ['image', 'inspect', image], true, true)).code === 0) return;
  let archive = databaseArchive(database);
  try {
    await access(archive);
  } catch {
    const uncompressed = archive.slice(0, -3);
    try {
      await access(uncompressed);
      archive = uncompressed;
    } catch {
      throw new Error(`database archive is missing: ${archive}`);
    }
  }
  console.log(`Image ${image} is missing; loading ${archive}`);
  await runner('docker', ['load', '--input', archive]);
  if ((await runner('docker', ['image', 'inspect', image], true, true)).code !== 0) {
    throw new Error(`${archive} did not contain the expected image ${image}`);
  }
}

export async function orchestrate(
  config: Config,
  runner: Runner = runCommand,
  resolveTarball: (source: string) => Promise<string> = resolveClientTarball,
): Promise<void> {
  await step('Check Docker', () => ensureDocker(runner));
  const needsServer = config.databases.length === 0 || config.databases.some(({ type }) => type !== 'bucket');
  if (needsServer && !config.pmmServer) {
    await step('Start PMM Server and wait until ready', () => startServer(config, runner));
  }
  if (config.databases.length === 0) return;
  const clientArgs = needsServer
    ? await step('Resolve PMM Client', () => resolveClientArgs(config.clientVersion, resolveTarball))
    : [];
  for (const database of config.databases) {
    await step(`Load ${database.type.toUpperCase()} ${database.version} image`, () =>
      ensureDatabaseImage(database, runner),
    );
  }
  const provision = (database: DatabaseConfig) =>
    step(`Provision ${database.type.toUpperCase()} ${database.version}`, async () => {
      const result = await runner(
        process.execPath,
        provisionerArgs(
          database,
          clientArgs,
          config.adminPassword,
          config.clientDebug,
          config.encryptedClientConfig,
          config.pmmServer ?? SERVER,
          config.metricsMode,
          config.databases,
        ),
        true,
      );
      if (result.code !== 0) throw new Error(`${database.type} provisioning failed`);
    });
  const haproxy = config.databases.filter((database) => database.type === 'haproxy');
  await Promise.all(config.databases.filter((database) => database.type !== 'haproxy').map(provision));
  await Promise.all(haproxy.map(provision));
}

export async function resolveClientArgs(
  clientVersion: string,
  resolveTarball: (source: string) => Promise<string> = resolveClientTarball,
): Promise<string[]> {
  const tarballSource =
    clientVersion === 'latest-tarball'
      ? 'latest'
      : /^https?:\/\//i.test(clientVersion)
        ? clientVersion
        : undefined;
  return tarballSource
    ? ['--client-tarball', await resolveTarball(tarballSource)]
    : ['--client-version', clientVersion];
}

export async function main(): Promise<void> {
  const config = parseConfig();
  if (config.help) {
    console.log(HELP);
    return;
  }
  const started = performance.now();
  if (config.teardown) {
    await teardown();
    console.log(`\nTeardown completed successfully (${((performance.now() - started) / 1000).toFixed(1)}s total).`);
    return;
  }
  await orchestrate(config);
  console.log(`\nProvisioning completed successfully (${((performance.now() - started) / 1000).toFixed(1)}s total).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
