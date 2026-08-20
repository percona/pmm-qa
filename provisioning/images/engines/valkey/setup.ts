import { parseArgs } from 'node:util';
import {
  configurePmm, docker, PMM_CLIENT_OPTIONS, pmmClientConfig, preparePmm, registerPmmService, retry,
  step, type PmmClientConfig, waitForPmmExporter,
} from '../../../pmm-client.ts';

type SetupType = 'cluster' | 'sentinel';
export interface Config extends PmmClientConfig {
  version: '7' | '8'; image: string; setupType: SetupType; clientTarball?: string;
  pmmServer?: string; password: string;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.engine=valkey';

export function parseConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const { values } = parseArgs({ args: argv, strict: true, options: {
    version: { type: 'string' }, image: { type: 'string' }, 'setup-type': { type: 'string' },
    ...PMM_CLIENT_OPTIONS, password: { type: 'string' },
  }});
  const version = values.version ?? env.VALKEY_VERSION ?? '8';
  if (version !== '7' && version !== '8') throw new Error('version must be 7 or 8');
  const setupType = (values['setup-type'] ?? env.SETUP_TYPE ?? 'cluster').toLowerCase();
  if (setupType !== 'cluster' && !['sentinel', 'sentinels'].includes(setupType)) {
    throw new Error('setup type must be cluster or sentinel');
  }
  return {
    version, image: values.image ?? env.VALKEY_IMAGE ?? `pmm-qa/valkey:${version}`,
    setupType: (setupType === 'sentinels' ? 'sentinel' : setupType) as SetupType,
    ...pmmClientConfig(values, env),
    password: values.password ?? env.VALKEY_PASSWORD ?? 'VKvl41568AsE',
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

async function ready(name: string, password: string, port: string): Promise<void> {
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
  const [server, tarball] = await preparePmm(config, config.image, 'npm run build');
  await step('Clean previous run', cleanup);
  const names = await step(`Start Valkey ${config.setupType}`, () => start(config));
  await configurePmm(config, names, server, tarball);
  await step('Register Valkey services', () => Promise.all(names.map((name) => registerPmmService([
    'exec', name, 'pmm-admin', 'add', 'valkey', '--cluster=valkey-cluster', '--environment=valkey-test',
    '--username=default', `--password=${config.password}`, `--service-name=${name}`,
    `--host=${name}`, `--port=${name.startsWith('valkey-sentinel-') ? 26379 : 6379}`,
    `--custom-labels=role=${name.includes('primary') || name.endsWith('-1') ? 'primary' : name.includes('sentinel') ? 'sentinel' : 'replica'}`,
  ]))).then(() => undefined));
  await step('Wait for Valkey exporters', () =>
    Promise.all(names.map((name) => waitForPmmExporter(name, 'valkey_exporter'))).then(() => undefined));
  await step('Run Valkey workload', () => docker(['exec', names[0], 'valkey-cli', '-a', config.password, 'SET', 'pmm-qa', 'ready']));
}

if (import.meta.main) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
