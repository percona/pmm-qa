import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTAINER_RUNTIME, connectDockerNetwork, discoverPmmServer, resolveClientTarball, retry, step, stepTimings, type StepTiming } from './pmm-client.ts';
import { containerName as mysqlContainerName } from './images/setup.ts';
import { containerName as pxcContainerName } from './images/engines/pxc/setup.ts';
import { MINIMUM_NODES } from './images/lib/engines.ts';

export type DatabaseType = keyof typeof DATABASES;

export interface DatabaseConfig {
  type: DatabaseType;
  version: string;
  options: Record<string, string>;
}

export interface Config {
  databases: DatabaseConfig[];
  serverImage: string;
  serverPort: string;
  serverEnv: string[];
  watchtower: boolean;
  pmmServer?: string;
  adminPassword: string;
  clientVersion: string;
  metricsMode: string;
  clientDebug: boolean;
  encryptedClientConfig: boolean;
  reuseServer: boolean;
  sequential: boolean;
  verbose: boolean;
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
  label?: string,
) => Promise<CommandResult>;

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const NETWORK = 'pmm-qa';
const SERVER = 'pmm-server';
const WATCHTOWER = 'watchtower';
const TEARDOWN_LABELS = ['pmm-qa.orchestrator=server', 'pmm-qa.engine'];
const TEARDOWN_VOLUME_PREFIXES = ['pmm-qa-', 'psmdb-', 'mysql-ps-minio-backups', 'pmm-data'];
const SERVER_VOLUME = 'pmm-data';
const DIAGNOSTICS_DIR = resolve(ROOT, '..', 'provisioning-artifacts');
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const SERVERLESS_TYPES = new Set<DatabaseType>(['bucket']);

export const DATABASES = {
  mysql: { versions: ['5.7', '8.0', '8.4', '9.7'], defaultVersion: '9.7', script: ['images', 'setup.ts'], selector: ['engine', 'mysql'] },
  ps: { versions: ['5.7', '8.0', '8.4'], defaultVersion: '8.0', script: ['images', 'setup.ts'], selector: ['engine', 'ps'] },
  pxc: { versions: ['5.7', '8.0'], defaultVersion: '8.0', script: ['images', 'engines', 'pxc', 'setup.ts'] },
  psmdb: { versions: ['6.0', '7.0', '8.0', 'latest'], defaultVersion: '8.0', script: ['images', 'engines', 'psmdb', 'setup.ts'], selector: ['engine', 'psmdb'] },
  mongodb: { versions: ['6.0', '7.0', '8.0'], defaultVersion: '8.0', script: ['images', 'engines', 'psmdb', 'setup.ts'], selector: ['engine', 'mongodb'] },
  pgsql: { versions: ['16', '17', '18'], defaultVersion: '18', script: ['images', 'engines', 'pgsql', 'setup.ts'] },
  pdpgsql: { versions: ['14', '15', '16', '17', '18'], defaultVersion: '18', script: ['images', 'engines', 'pdpgsql', 'setup.ts'] },
  valkey: { versions: ['7', '8'], defaultVersion: '8', script: ['images', 'engines', 'valkey', 'setup.ts'] },
  client: { versions: ['latest'], defaultVersion: 'latest', script: ['images', 'engines', 'services', 'setup.ts'], selector: ['type', 'client'] },
  haproxy: { versions: ['latest'], defaultVersion: 'latest', script: ['images', 'engines', 'services', 'setup.ts'], selector: ['type', 'haproxy'] },
  external: { versions: ['latest'], defaultVersion: 'latest', script: ['images', 'engines', 'services', 'setup.ts'], selector: ['type', 'external'] },
  bucket: { versions: ['latest'], defaultVersion: 'latest', script: ['images', 'engines', 'minio', 'setup.ts'] },
  'mlaunch-psmdb': { versions: ['6.0', '7.0', '8.0'], defaultVersion: '8.0', script: ['images', 'engines', 'mlaunch', 'setup.ts'], selector: ['engine', 'psmdb'] },
  'mlaunch-mongodb': { versions: ['6.0', '7.0', '8.0'], defaultVersion: '8.0', script: ['images', 'engines', 'mlaunch', 'setup.ts'], selector: ['engine', 'mongodb'] },
} as const;

const HELP = `Usage: node provisioning/setup.ts [--db DESCRIPTOR] [--db DESCRIPTOR] [options]

  --db mysql=VERSION,setup-type=single|replication|gr,query-source=perfschema|slowlog
  --db ps=VERSION,setup-type=single|replication|gr,query-source=perfschema|slowlog
  --db pxc=VERSION,nodes=NUMBER,query-source=perfschema|slowlog
  --db psmdb=VERSION,setup-type=pss|psa|sharding,storage-engine=wiredTiger|inMemory,replica-sets=1|2,ol-version=8|9
  --db mongodb=VERSION,setup-type=pss|psa|sharding
  --db pgsql=VERSION,setup-type=single|replication,nodes=NUMBER,use-socket=true
  --db pdpgsql=VERSION,setup-type=single|replication|patroni,nodes=NUMBER
  --db valkey=VERSION,setup-type=cluster|sentinel
  --db client                 standalone PMM Client node, without a database
  --db haproxy
  --db external
  --db bucket,buckets=bcp;archive
  --db mlaunch-psmdb=VERSION,setup-type=single|pss   single-container mongod or 3-node replica set
  --db mlaunch-mongodb=VERSION,setup-type=single|pss
  --server-image IMAGE       default: perconalab/pmm-server:3-dev-latest
  --server-port PORT         host port mapped to the server's 8443 (default: 443)
  --server-env KEY=VALUE     extra env for the server container, repeatable (PMM_DEBUG=1 by default)
  --watchtower               also run watchtower, for PMM's in-place upgrade flow
  --pmm-server HOST[:PORT]   use an existing PMM Server
  --admin-password PASSWORD  default: admin
  --client-version VERSION   version or tarball URL (default: latest-tarball)
  --metrics-mode MODE        PMM metrics mode (default: auto)
  --client-debug
  --encrypted-client-config
  --reuse-server             discover and reuse a running pmm-server instead of creating one
  --sequential                provision databases one at a time instead of concurrently
  --verbose                   also print buffered output for successful provisioning jobs
  --teardown                 remove all pmm-qa provisioned containers, volumes, and network
  --help

PS also accepts nodes, workload-seconds, skip-workload, my-rocks, backup, and buckets.
MYSQL, PS, PSMDB, MongoDB, PGSQL, PDPGSQL, and mlaunch-psmdb accept tls=true; ssl_NAME aliases enable it (e.g. ssl_mlaunch-psmdb).
Repeat --db to provision multiple database types or distinct topologies.
Omit --db to provision PMM Server only.
--reuse-server is ignored when --pmm-server is set; it fails if no pmm-server container is found.
--teardown ignores --db and removes everything this script previously provisioned.
pmm-framework spellings are accepted: --database, --pmm-server-ip, --pmm-server-password, --v,
UPPER_CASE option keys, and --parallel/--verbosity-level (ignored; concurrent is already default).
Set CONTAINER_RUNTIME=podman to drive podman instead of docker.`;

// pmm-framework's flag spellings, accepted so its callers (CI workflows, skills, muscle memory)
// keep working unchanged. --parallel is already the default and --verbosity-level was Ansible-only,
// so both are dropped rather than translated.
const FLAG_ALIASES: Record<string, string> = {
  '--database': '--db',
  '--pmm-server-ip': '--pmm-server',
  '--pmm-server-password': '--admin-password',
  '--v': '--verbose',
};
const DROPPED_FLAGS = new Set(['--parallel']);
const DROPPED_VALUE_FLAGS = new Set(['--verbosity-level']);

// pmm-framework spec options that moved to build time or a global flag. Named here so a stale
// caller gets told where the capability went instead of an engine's "Unknown option --tarball".
const RETIRED_OPTIONS: Record<string, string> = {
  'pgsm-branch': 'build option now: npm run build -- pdpgsql=18,pgsm-branch=BRANCH',
  'client-version': 'use the global --client-version',
};

// Spec options that select which image gets built rather than how it is provisioned. Lifted out of
// the options map and folded into the build descriptor, so pmm-framework's spelling still works.
const BUILD_OPTIONS = new Set(['tarball']);

export function normalizeArgv(argv: string[]): string[] {
  const normalized: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf('=');
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    if (DROPPED_FLAGS.has(flag)) continue;
    if (DROPPED_VALUE_FLAGS.has(flag)) {
      if (equals === -1 && !argv[index + 1]?.startsWith('-')) index += 1;
      continue;
    }
    const alias = FLAG_ALIASES[flag];
    if (!alias) normalized.push(argument);
    else normalized.push(equals === -1 ? alias : `${alias}${argument.slice(equals)}`);
  }
  return normalized;
}

export function parseDatabase(value: string): DatabaseConfig {
  const [head, ...entries] = value.split(',');
  const separator = head.indexOf('=');
  const requestedType = (separator === -1 ? head : head.slice(0, separator)).toLowerCase().replaceAll('_', '-');
  const tlsAlias = requestedType.startsWith('ssl-');
  const type = tlsAlias ? requestedType.slice(4) : requestedType;
  if (!(type in DATABASES)) throw new Error('unknown provisioning type');
  const databaseType = type as DatabaseType;
  const requestedVersion = separator === -1 ? DATABASES[databaseType].defaultVersion : head.slice(separator + 1);
  if (!DATABASES[databaseType].versions.includes(requestedVersion as never)) {
    throw new Error(`${type} version must be ${DATABASES[databaseType].versions.join(', ')}`);
  }
  const options: Record<string, string> = tlsAlias ? { tls: 'true' } : {};
  for (const entry of entries) {
    const equals = entry.indexOf('=');
    if (equals < 1 || equals === entry.length - 1) throw new Error(`invalid ${type} option: ${entry}`);
    const key = entry.slice(0, equals).toLowerCase().replaceAll('_', '-');
    const retired = RETIRED_OPTIONS[key];
    if (retired) throw new Error(`${key} is not a provisioning option: ${retired}`);
    options[key] = entry.slice(equals + 1);
  }
  return { type: databaseType, version: type === 'psmdb' && requestedVersion === 'latest' ? '8.0' : requestedVersion, options };
}

export function parseConfig(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Config {
  const { values } = parseArgs({
    args: normalizeArgv(argv),
    strict: true,
    options: {
      db: { type: 'string', multiple: true },
      'server-image': { type: 'string' },
      'server-port': { type: 'string' },
      'server-env': { type: 'string', multiple: true },
      watchtower: { type: 'boolean' },
      'pmm-server': { type: 'string' },
      'admin-password': { type: 'string' },
      'client-version': { type: 'string' },
      'metrics-mode': { type: 'string' },
      'client-debug': { type: 'boolean' },
      'encrypted-client-config': { type: 'boolean' },
      'reuse-server': { type: 'boolean' },
      sequential: { type: 'boolean' },
      verbose: { type: 'boolean' },
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
  const clientVersion = values['client-version'] ?? env.CLIENT_VERSION ?? 'latest-tarball';
  if (
    !['3-dev-latest', 'pmm3-rc', 'pmm3-latest', 'latest-tarball'].includes(clientVersion) &&
    !/^3\.\d+\.\d+(-[\w.]+)?$/.test(clientVersion) &&
    !/^https?:\/\//i.test(clientVersion)
  ) {
    throw new Error(
      'client version must be 3-dev-latest, pmm3-rc, pmm3-latest, 3.x.y[-suffix], latest-tarball, or a tarball URL',
    );
  }
  return {
    databases,
    serverImage: values['server-image'] ?? env.DOCKER_VERSION ?? 'perconalab/pmm-server:3-dev-latest',
    serverPort: values['server-port'] ?? '443',
    serverEnv: values['server-env'] ?? [],
    watchtower: values.watchtower ?? false,
    pmmServer: values['pmm-server'],
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    clientVersion,
    metricsMode: values['metrics-mode'] ?? 'auto',
    clientDebug: values['client-debug'] ?? false,
    encryptedClientConfig: values['encrypted-client-config'] ?? false,
    reuseServer: values['reuse-server'] ?? false,
    sequential: values.sequential ?? false,
    verbose: values.verbose ?? false,
    teardown,
    help,
  };
}

export function databaseImage(database: DatabaseConfig): string {
  return `pmm-qa/${database.type}:${database.version}${databaseSuffix(database)}`;
}

export function databaseArchive(database: DatabaseConfig): string {
  return resolve(ROOT, 'images', `${database.type}${database.version}${databaseSuffix(database)}.tar.gz`);
}

export function databaseSuffix(database: DatabaseConfig): string {
  if (database.type === 'psmdb' && database.options['ol-version']) return `-ol${database.options['ol-version']}`;
  // A tarball build must not reuse the tag a packaged build already occupies, or
  // ensureDatabaseImage() would skip the build and provision the wrong binaries.
  const tarball = database.options.tarball;
  if (tarball) return `-tb${createHash('sha256').update(tarball).digest('hex').slice(0, 8)}`;
  return '';
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
  const spec = DATABASES[database.type];
  const args = [resolve(ROOT, ...spec.script)];
  if ('selector' in spec) args.push(`--${spec.selector[0]}`, spec.selector[1]);
  args.push('--image', databaseImage(database));
  if (database.type !== 'bucket') {
    if (!['client', 'haproxy', 'external'].includes(database.type)) {
      args.push('--version', database.version);
    }
    args.push('--pmm-server', pmmServer, '--admin-password', adminPassword, ...clientArgs);
    if (clientDebug) args.push('--client-debug');
    if (encryptedClientConfig) args.push('--encrypted-client-config');
    args.push('--metrics-mode', metricsMode);
  }
  const options = { ...database.options };
  if (options['compose-profiles']) {
    const replicaSets = options['compose-profiles'].toLowerCase() === 'extra' ? '2' : '1';
    if (options['replica-sets'] && options['replica-sets'] !== replicaSets) {
      throw new Error('compose-profiles conflicts with replica-sets');
    }
    options['replica-sets'] = replicaSets;
  }
  for (const [key, value] of Object.entries(options)) {
    if (key === 'ol-version' || key === 'compose-profiles' || BUILD_OPTIONS.has(key) || (database.type === 'pxc' && key === 'setup-type')) continue;
    const normalized = value.toLowerCase();
    if (TRUE_VALUES.has(normalized)) args.push(`--${key}`);
    else if (!FALSE_VALUES.has(normalized)) args.push(`--${key}`, value);
  }
  if (database.type === 'haproxy') {
    const targets = backendTargets(allDatabases.filter((sibling) => sibling !== database));
    if (targets.length) args.push('--backends', targets.join(','));
  }
  return args;
}

// A buffered job prints nothing until it settles, which leaves a parallel run silent for minutes.
// Its step markers are echoed live anyway so there is always visible progress; everything else stays
// buffered for the failure dump or --verbose.
export const IMPORTANT_LINE = /^(==>|<==|<!!|\[FAIL\])/;

export function importantLineEcho(
  label: string | undefined,
  print: (line: string) => void = console.log,
): (chunk: Buffer | string) => void {
  let pending = '';
  return (chunk) => {
    if (!label) return;
    const lines = (pending + chunk.toString()).split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const text = line.trimEnd();
      if (IMPORTANT_LINE.test(text)) print(`[${label}] ${text}`);
    }
  };
}

export const runCommand: Runner = (file, args, allowFailure = false, quiet = false, label) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const echoOut = importantLineEcho(label);
    const echoErr = importantLineEcho(label);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
      if (quiet) echoOut(chunk);
      else process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk);
      if (quiet) echoErr(chunk);
      else process.stderr.write(chunk);
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

export async function ensureDocker(runner: Runner): Promise<void> {
  if ((await runner(CONTAINER_RUNTIME, ['info'], true, true)).code !== 0) {
    throw new Error('Docker is not running');
  }
}

export async function teardownContainerIds(runner: Runner): Promise<string[]> {
  const idLists = await Promise.all(
    TEARDOWN_LABELS.map((label) => runner(CONTAINER_RUNTIME, ['ps', '-aq', '--filter', `label=${label}`], true, true)),
  );
  return [...new Set(idLists.flatMap((result) => result.stdout.trim().split(/\s+/).filter(Boolean)))];
}

export async function teardownVolumeNames(runner: Runner): Promise<string[]> {
  const nameLists = await Promise.all(
    TEARDOWN_VOLUME_PREFIXES.map((prefix) => runner(CONTAINER_RUNTIME, ['volume', 'ls', '-q', '--filter', `name=${prefix}`], true, true)),
  );
  return [...new Set(nameLists.flatMap((result) => result.stdout.trim().split(/\s+/).filter(Boolean)))];
}

export async function teardown(runner: Runner = runCommand): Promise<void> {
  await ensureDocker(runner);
  const containerIds = await teardownContainerIds(runner);
  if (containerIds.length) await runner(CONTAINER_RUNTIME, ['rm', '-fv', ...containerIds]);
  const volumeNames = await teardownVolumeNames(runner);
  if (volumeNames.length) await runner(CONTAINER_RUNTIME, ['volume', 'rm', '-f', ...volumeNames], true);
  await runner(CONTAINER_RUNTIME, ['network', 'rm', NETWORK], true);
}

async function ensureNetwork(runner: Runner): Promise<void> {
  if ((await runner(CONTAINER_RUNTIME, ['network', 'inspect', NETWORK], true, true)).code !== 0) {
    await runner(CONTAINER_RUNTIME, ['network', 'create', NETWORK]);
  }
}

export type ImageFreshness = 'current' | 'stale' | 'unknown';

// `docker pull` re-checks every layer against the registry even when nothing changed. The manifest
// digest answers "is my local copy still the tag's current image?" in about a second without
// fetching any layer, so the pull can be skipped when they match -- and only when they match.
export async function serverImageFreshness(image: string, runner: Runner): Promise<ImageFreshness> {
  const local = await runner(CONTAINER_RUNTIME, ['image', 'inspect', image, '--format', '{{index .RepoDigests 0}}'], true, true);
  const digest = local.stdout.trim().split('@')[1];
  if (!digest) return 'stale';
  const remote = await runner(
    'docker',
    ['buildx', 'imagetools', 'inspect', image, '--format', '{{.Manifest.Digest}}'],
    true,
    true,
  );
  if (remote.code !== 0) return 'unknown';
  return remote.stdout.trim() === digest ? 'current' : 'stale';
}

export async function createServer(
  config: Pick<Config, 'serverImage' | 'adminPassword' | 'serverPort' | 'serverEnv' | 'watchtower'>,
  runner: Runner,
): Promise<void> {
  const serverEnv = config.serverEnv.some((entry) => entry.startsWith('PMM_DEBUG='))
    ? config.serverEnv
    : ['PMM_DEBUG=1', ...config.serverEnv];

  await runner(CONTAINER_RUNTIME, ['rm', '-f', SERVER, WATCHTOWER], true, true);
  await runner(CONTAINER_RUNTIME, ['volume', 'rm', '-f', SERVER_VOLUME], true, true);
  await ensureNetwork(runner);
  const freshness = await serverImageFreshness(config.serverImage, runner);
  if (freshness === 'current') {
    console.log(`${config.serverImage} already matches the registry digest; skipping pull`);
  } else {
    await runner(CONTAINER_RUNTIME, ['pull', config.serverImage]);
  }
  await runner(CONTAINER_RUNTIME, ['volume', 'create', SERVER_VOLUME]);
  await runner(CONTAINER_RUNTIME, [
    'run',
    '--detach',
    '--restart=always',
    '--name',
    SERVER,
    '--hostname',
    SERVER,
    '--label',
    'pmm-qa.orchestrator=server',
    '--network',
    NETWORK,
    '--publish',
    `${config.serverPort}:8443`,
    '--env',
    'PMM_ENABLE_TELEMETRY=0',
    '--env',
    'GF_SECURITY_ADMIN_USER=admin',
    '--env',
    `GF_SECURITY_ADMIN_PASSWORD=${config.adminPassword}`,
    ...serverEnv.flatMap((entry) => ['--env', entry]),
    '--volume',
    `${SERVER_VOLUME}:/srv`,
    config.serverImage,
  ]);
  if (!config.watchtower) return;
  // PMM's in-place upgrade flow drives watchtower over the docker socket; it only exists for
  // upgrade tests, so it stays opt-in.
  await runner(CONTAINER_RUNTIME, [
    'run',
    '--detach',
    '--name',
    WATCHTOWER,
    '--label',
    'pmm-qa.orchestrator=server',
    '--network',
    NETWORK,
    '--volume',
    '/var/run/docker.sock:/var/run/docker.sock',
    '--env',
    'WATCHTOWER_HTTP_API_UPDATE=1',
    '--env',
    `WATCHTOWER_HTTP_API_TOKEN=${config.adminPassword}`,
    'perconalab/watchtower',
  ]);
}

export async function waitForServer(
  runner: Runner,
  pause: (milliseconds: number) => Promise<unknown> = sleep,
): Promise<void> {
  await retry(
    'PMM Server',
    () => runner(CONTAINER_RUNTIME, ['exec', SERVER, 'curl', '-f', 'http://127.0.0.1:8080/v1/server/readyz'], true, true),
    (result) => result.code === 0,
    () => true,
    120,
    pause,
  );
}

// Reusing a server trades freshness for speed, so say out loud which image the reused container is
// running and whether the registry has moved past it.
export async function reportReusedServer(name: string, runner: Runner): Promise<void> {
  const info = await runner(
    'docker',
    ['inspect', '--format', '{{.Config.Image}} {{.Created}}', name.replace(/^https?:\/\//, '').split(':')[0]],
    true,
    true,
  );
  const [image, created] = info.stdout.trim().split(/\s+/);
  if (!image) return;
  const freshness = await serverImageFreshness(image, runner);
  const note = {
    current: 'matches the registry',
    stale: 'the registry has a newer image; drop --reuse-server to recreate it',
    unknown: 'could not reach the registry to compare',
  }[freshness];
  console.log(`Reusing ${name}: ${image} created ${created} -- ${note}`);
}

export function buildDescriptor(database: DatabaseConfig): string {
  const parts = [`${database.type}=${database.version}`];
  const olVersion = database.type === 'psmdb' ? database.options['ol-version'] : undefined;
  if (olVersion) parts.push(`ol-version=${olVersion}`);
  for (const key of BUILD_OPTIONS) {
    if (database.options[key]) parts.push(`${key}=${database.options[key]}`);
  }
  return parts.join(',');
}

async function ensureDatabaseImage(database: DatabaseConfig, runner: Runner): Promise<void> {
  const image = databaseImage(database);
  if ((await runner(CONTAINER_RUNTIME, ['image', 'inspect', image], true, true)).code === 0) return;
  let archive = databaseArchive(database);
  try {
    await access(archive);
  } catch {
    const uncompressed = archive.slice(0, -3);
    try {
      await access(uncompressed);
      archive = uncompressed;
    } catch {
      // No prebuilt image and no archive: build it, so a caller never has to remember which
      // `npm run build --` lines its --db list implies.
      const descriptor = buildDescriptor(database);
      console.log(`Image ${image} is missing; building ${descriptor}`);
      await runner(process.execPath, [resolve(ROOT, 'images', 'build.ts'), descriptor]);
      if ((await runner(CONTAINER_RUNTIME, ['image', 'inspect', image], true, true)).code !== 0) {
        throw new Error(`building ${descriptor} did not produce ${image}`);
      }
      return;
    }
  }
  console.log(`Image ${image} is missing; loading ${archive}`);
  await runner(CONTAINER_RUNTIME, ['load', '--input', archive]);
  if ((await runner(CONTAINER_RUNTIME, ['image', 'inspect', image], true, true)).code !== 0) {
    throw new Error(`${archive} did not contain the expected image ${image}`);
  }
}

export function reportProvisionResult(label: string, result: CommandResult, verbose: boolean, buffered: boolean): void {
  const failed = result.code !== 0;
  // Output was already streamed live (not buffered) when the job ran non-quiet, so
  // re-printing it here would duplicate it -- just a one-line summary in that case.
  if (!buffered) {
    console.log(`[${label}] ${failed ? 'FAILED' : 'OK'}`);
    return;
  }
  if (!failed && !verbose) {
    console.log(`[${label}] OK`);
    return;
  }
  console.log(`\n===== ${label}${failed ? ' FAILED' : ''} =====`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(`===== END ${label} =====`);
}

// Engine provisioners run as child processes whose step lines are buffered away in the default
// parallel mode, so lift their timings out of the captured output into the run's own summary.
export function childStepTimings(label: string, output: string): StepTiming[] {
  return [...output.matchAll(/^<[=!][=!] (.+?) \((\d+(?:\.\d+)?)s\)\r?$/gm)].map(([, name, seconds]) => ({
    name: `${label} · ${name}`,
    seconds: Number(seconds),
  }));
}

export function formatStepSummary(timings: StepTiming[], minimumSeconds = 1): string {
  const important = timings
    .filter(({ seconds }) => seconds >= minimumSeconds)
    .sort((first, second) => second.seconds - first.seconds);
  if (!important.length) return '';
  return [
    '\nSlowest steps:',
    ...important.map(({ name, seconds }) => `  ${`${seconds.toFixed(1)}s`.padStart(7)}  ${name}`),
  ].join('\n');
}

export async function provisionDatabases(
  databases: DatabaseConfig[],
  provisionOne: (database: DatabaseConfig) => Promise<void>,
  sequential: boolean,
): Promise<void> {
  if (sequential) {
    for (const database of databases) await provisionOne(database);
    return;
  }
  const results = await Promise.allSettled(databases.map(provisionOne));
  const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed.length) throw new Error(`${failed.length} of ${databases.length} database provisioning job(s) failed`);
}

export async function orchestrate(
  config: Config,
  runner: Runner = runCommand,
  resolveTarball: (source: string) => Promise<string> = resolveClientTarball,
  discoverServer: (configured?: string) => Promise<string> = discoverPmmServer,
  connectServerToNetwork: (name: string, network?: string) => Promise<void> = connectDockerNetwork,
): Promise<void> {
  await Promise.all(config.databases.map(async (database) => {
    const [script, ...args] = provisionerArgs(
      database, [], config.adminPassword, config.clientDebug,
      config.encryptedClientConfig, config.pmmServer, config.metricsMode, config.databases,
    );
    const { parseConfig: validate } = await import(pathToFileURL(script).href);
    validate(args, process.env);
  }));
  await step('Check Docker', () => ensureDocker(runner));
  const needsServer =
    config.databases.length === 0 || config.databases.some(({ type }) => !SERVERLESS_TYPES.has(type));
  // Neither the client tarball nor the database images need PMM Server, so fetch them while it
  // pulls and boots -- otherwise both waits are paid one after the other.
  const prefetch = Promise.all([
    needsServer && config.databases.length
      ? step('Resolve PMM Client', () => resolveClientArgs(config.clientVersion, resolveTarball))
      : ([] as string[]),
    (async () => {
      for (const database of config.databases) {
        await step(`Load ${database.type.toUpperCase()} ${database.version} image`, () =>
          ensureDatabaseImage(database, runner),
        );
      }
    })(),
  ]);
  prefetch.catch(() => undefined);
  let serverAddress = config.pmmServer;
  if (needsServer && !config.pmmServer) {
    if (config.reuseServer) {
      serverAddress = await step('Discover PMM Server', async () => {
        try {
          return await discoverServer();
        } catch (error) {
          throw new Error('no PMM server found; pass --pmm-server or omit --reuse-server', { cause: error });
        }
      });
      await step('Connect PMM Server to network', () => connectServerToNetwork(serverAddress!));
      await step('Check reused PMM Server image', () => reportReusedServer(serverAddress!, runner));
    } else {
      await step('Create PMM Server', () => createServer(config, runner));
      serverAddress = SERVER;
      // Each engine waits for readiness itself (configurePmm), so the database build overlaps the
      // server's boot. A server-only run has nothing to overlap, so it waits here.
      if (config.databases.length === 0) {
        await step('Wait until PMM Server is ready', () => waitForServer(runner));
      }
    }
  }
  const [clientArgs] = await prefetch;
  if (config.databases.length === 0) return;
  const provision = (database: DatabaseConfig) =>
    step(`Provision ${database.type.toUpperCase()} ${database.version}`, async () => {
      const label = `${database.type.toUpperCase()} ${database.version}`;
      const result = await runner(
        process.execPath,
        provisionerArgs(
          database,
          clientArgs,
          config.adminPassword,
          config.clientDebug,
          config.encryptedClientConfig,
          serverAddress ?? SERVER,
          config.metricsMode,
          config.databases,
        ),
        true,
        !config.sequential,
        label,
      );
      stepTimings.push(...childStepTimings(label, `${result.stdout}\n${result.stderr}`));
      reportProvisionResult(label, result, config.verbose, !config.sequential);
      if (result.code !== 0) throw new Error(`${database.type} provisioning failed`);
    });
  const haproxy = config.databases.filter((database) => database.type === 'haproxy');
  await provisionDatabases(config.databases.filter((database) => database.type !== 'haproxy'), provision, config.sequential);
  await provisionDatabases(haproxy, provision, config.sequential);
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

function redactDiagnostics(value: string, secrets: string[]): string {
  let redacted = value;
  for (const secret of secrets.filter(Boolean)) redacted = redacted.replaceAll(secret, '[redacted]');
  return redacted
    .replace(/(password|token|secret)(["'=:\s]+)([^\s",}]+)/gi, '$1$2[redacted]')
    .replace(/((?:https?|mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^:\s/]+:)[^@\s/]+@/gi, '$1[redacted]@')
    .replace(/(https?:\/\/[^\s?'"<>]+)\?[^\s'"<>]+/gi, '$1?[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(^|\s)-p\S+/gm, '$1-p[redacted]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[redacted private key]');
}

export async function collectDiagnostics(
  config: Config,
  error: unknown,
  runner: Runner = runCommand,
  directory = DIAGNOSTICS_DIR,
): Promise<string> {
  await mkdir(directory, { recursive: true });
  const safeRun = async (args: string[]): Promise<CommandResult> => {
    try {
      return await runner(CONTAINER_RUNTIME, args, true, true);
    } catch (commandError) {
      return { code: 1, stdout: '', stderr: String(commandError) };
    }
  };
  const optionSecrets = config.databases.flatMap(({ options }) => Object.entries(options)
    .filter(([key]) => /(pass|token|secret|key|credential|uri|url|tarball)/i.test(key))
    .map(([, value]) => value));
  const secrets = [
    config.adminPassword,
    ...optionSecrets,
    ...(/^https?:/i.test(config.clientVersion) ? [config.clientVersion] : []),
  ];
  const write = (name: string, value: string) =>
    writeFile(resolve(directory, name), redactDiagnostics(value, secrets));
  const summary = {
    error: error instanceof Error ? error.message : String(error),
    serverImage: config.serverImage,
    pmmServer: config.pmmServer,
    clientVersion: config.clientVersion.replace(/\?.*$/, '?[redacted]'),
    metricsMode: config.metricsMode,
    databases: config.databases,
  };
  await write('summary.json', `${JSON.stringify(summary, null, 2)}\n`);

  const containerResults = await Promise.all(TEARDOWN_LABELS.map((label) =>
    safeRun(['ps', '-a', '--filter', `label=${label}`, '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}']),
  ));
  const lines = [...new Set(containerResults.flatMap(({ stdout }) => stdout.trim().split(/\r?\n/).filter(Boolean)))];
  await write('containers.txt', `${lines.join('\n')}\n`);
  const network = await safeRun(['network', 'inspect', NETWORK]);
  await write('network.txt', `${network.stdout}${network.stderr}`);

  await Promise.all(lines.map(async (line) => {
    const [, name, image] = line.split('\t');
    if (!name) return;
    const safeName = name.replace(/[^a-z0-9_.-]/gi, '_');
    const [logs, status, list] = await Promise.all([
      safeRun(['logs', '--tail', '500', name]),
      safeRun(['exec', name, 'pmm-admin', 'status']),
      safeRun(['exec', name, 'pmm-admin', 'list']),
    ]);
    // The server's `docker logs` only carries startup output; anything that answers "why did the
    // API return that error" is in /srv/logs inside the container, and the container is usually
    // gone by the time anyone looks.
    const serverLogs = image?.includes('pmm-server')
      ? await safeRun(['exec', name, 'sh', '-c', 'tail -n 200 /srv/logs/*.log'])
      : undefined;
    await Promise.all([
      write(`${safeName}.log`, `${logs.stdout}${logs.stderr}`),
      write(`${safeName}-pmm.txt`, `${status.stdout}${status.stderr}\n${list.stdout}${list.stderr}`),
      ...(serverLogs ? [write(`${safeName}-srv-logs.txt`, `${serverLogs.stdout}${serverLogs.stderr}`)] : []),
    ]);
  }));
  return directory;
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
  try {
    await orchestrate(config);
  } catch (error) {
    try {
      const directory = await collectDiagnostics(config, error);
      console.error(`Provisioning diagnostics: ${directory}`);
    } catch (diagnosticError) {
      console.error(`Failed to collect provisioning diagnostics: ${diagnosticError}`);
    }
    throw error;
  } finally {
    const summary = formatStepSummary(stepTimings);
    if (summary) console.log(summary);
  }
  console.log(`\nProvisioning completed successfully (${((performance.now() - started) / 1000).toFixed(1)}s total).`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
