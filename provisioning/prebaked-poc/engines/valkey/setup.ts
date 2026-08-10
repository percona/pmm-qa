import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  connectDockerNetwork, discoverPmmServer, docker, envFlag, ensureDockerNetwork, installClient,
  registerPmmService, requireDockerImage, resolveClientTarball, retry, selectClientSource,
  setupPmmAgents, step, type PmmClientConfig,
} from '../../../pmm-client.ts';

type SetupType = 'cluster' | 'sentinel';
export interface Config extends PmmClientConfig {
  version: '7' | '8'; image: string; setupType: SetupType; clientTarball?: string;
  pmmServer?: string; password: string;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.poc=valkey-prebaked';

export function parseConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const { values } = parseArgs({ args: argv, strict: true, options: {
    version: { type: 'string' }, image: { type: 'string' }, 'setup-type': { type: 'string' },
    'client-tarball': { type: 'string' }, 'client-version': { type: 'string' },
    'pmm-server': { type: 'string' }, 'admin-password': { type: 'string' },
    password: { type: 'string' }, 'metrics-mode': { type: 'string' },
    'encrypted-client-config': { type: 'boolean' }, 'client-debug': { type: 'boolean' },
  }});
  const version = values.version ?? env.VALKEY_VERSION ?? '8';
  if (version !== '7' && version !== '8') throw new Error('version must be 7 or 8');
  const setupType = (values['setup-type'] ?? env.SETUP_TYPE ?? 'cluster').toLowerCase();
  if (setupType !== 'cluster' && !['sentinel', 'sentinels'].includes(setupType)) {
    throw new Error('setup type must be cluster or sentinel');
  }
  const client = selectClientSource(values['client-version'] ?? env.CLIENT_VERSION, values['client-tarball'] ?? env.CLIENT_TARBALL);
  return {
    version, image: values.image ?? env.VALKEY_IMAGE ?? `pmm-qa/valkey:${version}-prebaked`,
    setupType: (setupType === 'sentinels' ? 'sentinel' : setupType) as SetupType, ...client,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    password: values.password ?? env.VALKEY_PASSWORD ?? 'VKvl41568AsE',
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig: values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
  };
}

export function nodeNames(setupType: SetupType): string[] {
  return setupType === 'cluster'
    ? Array.from({ length: 6 }, (_, index) => `valkey-node-${index + 1}`)
    : ['valkey-primary', 'valkey-replica-1', 'valkey-replica-2', 'valkey-sentinel-1', 'valkey-sentinel-2', 'valkey-sentinel-3'];
}

function runArgs(config: Config, name: string, command: string): string[] {
  return ['run', '--detach', '--name', name, '--hostname', name, '--label', LABEL,
    '--label', `pmm-qa.valkey.setup-type=${config.setupType}`, '--network', NETWORK,
    '--entrypoint', 'sh', config.image, '-ceu', command];
}

export function clusterRunArgs(config: Config, name: string): string[] {
  return runArgs(config, name, `exec valkey-server --port 6379 --protected-mode no --requirepass '${config.password}' --masterauth '${config.password}' --appendonly yes --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000`);
}

export function sentinelRunArgs(config: Config, name: string): string[] {
  if (name.startsWith('valkey-sentinel-')) {
    return runArgs(config, name, `printf '%s\n' 'port 26379' 'sentinel resolve-hostnames yes' 'sentinel monitor valkey-primary valkey-primary 6379 2' 'sentinel auth-pass valkey-primary ${config.password}' 'sentinel down-after-milliseconds valkey-primary 5000' > /tmp/sentinel.conf; exec valkey-sentinel /tmp/sentinel.conf`);
  }
  const replica = name.startsWith('valkey-replica-') ? `--replicaof valkey-primary 6379` : '';
  return runArgs(config, name, `exec valkey-server --port 6379 --protected-mode no --requirepass '${config.password}' --masterauth '${config.password}' ${replica}`);
}

async function ready(name: string, password: string, port = '6379'): Promise<void> {
  await retry(`Valkey on ${name}`, () => docker(['exec', name, 'valkey-cli', '-p', port, '-a', password, 'ping'], true), (result) => result.stdout.includes('PONG'));
}

async function start(config: Config): Promise<string[]> {
  const names = nodeNames(config.setupType);
  for (const name of names) {
    await docker(config.setupType === 'cluster' ? clusterRunArgs(config, name) : sentinelRunArgs(config, name));
    await ready(name, config.password, name.startsWith('valkey-sentinel-') ? '26379' : '6379');
  }
  if (config.setupType === 'cluster') {
    await docker(['exec', names[0], 'sh', '-ceu', `yes yes | valkey-cli --cluster create ${names.map((name) => `${name}:6379`).join(' ')} --cluster-replicas 1 -a '${config.password}'`]);
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
  const names = await step(`Start Valkey ${config.setupType}`, () => start(config));
  const tarball = config.clientTarball ? await resolveClientTarball(config.clientTarball) : undefined;
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, server));
  await step('Register Valkey services', () => Promise.all(names.map((name) => registerPmmService([
    'exec', name, 'pmm-admin', 'add', 'valkey', '--cluster=valkey-cluster', '--environment=valkey-test',
    '--username=default', `--password=${config.password}`, `--service-name=${name}`,
    `--host=${name}`, `--port=${name.startsWith('valkey-sentinel-') ? 26379 : 6379}`,
    `--custom-labels=role=${name.includes('primary') || name.endsWith('-1') ? 'primary' : name.includes('sentinel') ? 'sentinel' : 'replica'}`,
  ]))).then(() => undefined));
  await step('Run Valkey workload', () => docker(['exec', names[0], 'valkey-cli', '-a', config.password, 'SET', 'pmm-qa', 'ready']));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
