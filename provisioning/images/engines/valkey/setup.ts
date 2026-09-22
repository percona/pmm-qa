import { parseArgs } from 'node:util';
import {
  configurePmm, containerIdsByLabel, docker, PMM_CLIENT_OPTIONS, pmmClientConfig, preparePmm, registerPmmService, retry,
  step, type PmmClientConfig, waitForPmmExporter,
} from '../../../pmm-client.ts';

type SetupType = 'cluster' | 'sentinel';
export interface Config extends PmmClientConfig {
  version: '7' | '8'; image: string; setupType: SetupType; password: string;
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
    ? ['valkey-primary-1', 'valkey-primary-2', 'valkey-primary-3', 'valkey-replica-4', 'valkey-replica-5', 'valkey-replica-6']
    : ['valkey-primary', 'valkey-replica-1', 'valkey-replica-2', 'valkey-sentinel-1', 'valkey-sentinel-2', 'valkey-sentinel-3'];
}

function runArgs(config: Config, name: string, command: string): string[] {
  return ['run', '--detach', '--name', name, '--hostname', name, '--label', LABEL,
    '--label', `pmm-qa.valkey.setup-type=${config.setupType}`, '--network', NETWORK,
    '--entrypoint', 'sh', config.image, '-ceu', command];
}

export function clusterRunArgs(config: Config, name: string): string[] {
  return runArgs(config, name, `exec valkey-server --port 6379 --protected-mode no --requirepass '${config.password}' --masterauth '${config.password}' --appendonly yes --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --maxmemory 1gb --maxmemory-policy allkeys-lru`);
}

export function sentinelRunArgs(config: Config, name: string): string[] {
  if (name.startsWith('valkey-sentinel-')) {
    return runArgs(config, name, `printf '%s\n' 'bind 0.0.0.0' 'port 26379' 'protected-mode no' 'sentinel resolve-hostnames yes' 'sentinel monitor valkey-primary valkey-primary 6379 2' 'sentinel auth-user valkey-primary default' 'sentinel auth-pass valkey-primary ${config.password}' 'sentinel down-after-milliseconds valkey-primary 5000' 'sentinel failover-timeout valkey-primary 10000' 'sentinel parallel-syncs valkey-primary 1' > /tmp/sentinel.conf; exec valkey-sentinel /tmp/sentinel.conf`);
  }
  const replica = name.startsWith('valkey-replica-') ? `--replicaof valkey-primary 6379` : '';
  return runArgs(config, name, `exec valkey-server --port 6379 --protected-mode no --requirepass '${config.password}' --masterauth '${config.password}' --save 900 1 --save 300 10 --save 60 10000 --replica-serve-stale-data yes --replica-read-only yes --repl-diskless-sync no --repl-diskless-sync-delay 5 --maxmemory 1gb --maxmemory-policy allkeys-lru ${replica}`);
}

const WORKLOAD = ['SET k$i v$i', 'GET k$i', 'HSET h$i f v', 'LPUSH l$i a b c', 'RPUSH l$i d e f', 'LRANGE l$i 0 -1', 'LPOP l$i', 'RPOP l$i'];
const READ_WORKLOAD = ['GET k$i', 'LRANGE l$i 0 -1'];

export function workloadArgs(config: Config, name: string): string[] {
  const workload = config.setupType === 'sentinel' && name.startsWith('valkey-replica-') ? READ_WORKLOAD : WORKLOAD;
  const cluster = config.setupType === 'cluster' ? ' -c' : '';
  const commands = workload.map((command) => `valkey-cli${cluster} -a '${config.password}' ${command} >/dev/null`).join('; ');
  return ['exec', name, 'sh', '-ceu', `for i in $(seq 1 50); do ${commands}; done`];
}

export function serviceArgs(config: Config, name: string): string[] {
  const sentinel = name.startsWith('valkey-sentinel-');
  const role = sentinel ? 'sentinel' : name.includes('primary') ? 'primary' : 'replica';
  return [
    'exec', name, 'pmm-admin', 'add', 'valkey',
    `--cluster=${config.setupType === 'cluster' ? 'valkey-native-cluster' : 'valkey-cluster'}`,
    ...(config.setupType === 'sentinel' && !sentinel ? ['--replication-set=valkey-repl'] : []),
    '--environment=valkey-test', '--username=default', `--password=${config.password}`, `--service-name=${name}`,
    `--host=${name}`, `--port=${sentinel ? 26379 : 6379}`, `--custom-labels=role=${role}`,
  ];
}

async function ready(name: string, password: string, port: string): Promise<void> {
  const auth = port === '26379' ? [] : ['-a', password];
  await retry(`Valkey on ${name}`, () => docker(['exec', name, 'valkey-cli', '-p', port, ...auth, 'ping'], true), (result) => result.stdout.includes('PONG'));
}

async function start(config: Config): Promise<string[]> {
  const names = nodeNames(config.setupType);
  for (const name of names) {
    await docker(config.setupType === 'cluster' ? clusterRunArgs(config, name) : sentinelRunArgs(config, name));
    await ready(name, config.password, name.startsWith('valkey-sentinel-') ? '26379' : '6379');
  }
  if (config.setupType === 'cluster') {
    await docker(['exec', names[0], 'sh', '-ceu', `yes yes | valkey-cli --cluster create ${names.map((name) => `${name}:6379`).join(' ')} --cluster-replicas 1 -a '${config.password}'`]);
    await retry('Valkey cluster', () => docker(['exec', names[0], 'valkey-cli', '-a', config.password, 'cluster', 'info'], true), (result) => result.stdout.includes('cluster_state:ok'));
  } else {
    await retry('Valkey replication', () => docker(['exec', 'valkey-primary', 'valkey-cli', '-a', config.password, 'info', 'replication'], true), (result) => result.stdout.includes('connected_slaves:2'));
    await retry('Valkey sentinels', () => docker(['exec', 'valkey-sentinel-1', 'valkey-cli', '-p', '26379', 'sentinel', 'ckquorum', 'valkey-primary'], true), (result) => result.stdout.includes('OK'));
  }
  return names;
}

async function cleanup(): Promise<void> {
  const ids = await containerIdsByLabel(`label=${LABEL}`);
  if (ids.length) {
    await Promise.all(ids.map((id) => docker(['exec', id, 'pmm-admin', 'unregister', '--force'], true)));
    await docker(['rm', '-fv', ...ids]);
  }
}

async function main(): Promise<void> {
  const config = parseConfig();
  await step('Check Docker', () => docker(['info']));
  const [server, tarball] = await preparePmm(config, config.image, 'npm run build');
  await step('Clean previous run', cleanup);
  const names = await step(`Start Valkey ${config.setupType}`, () => start(config));
  await configurePmm(config, names, server, tarball);
  await step('Register Valkey services', () => Promise.all(names.map((name) => registerPmmService(serviceArgs(config, name)))));
  await step('Wait for Valkey exporters', () =>
    Promise.all(names.map((name) => waitForPmmExporter(name, 'valkey_exporter'))));
  const workloadNodes = names.filter((name) => !name.startsWith('valkey-sentinel-'));
  await step('Run Valkey workload', () => Promise.all(workloadNodes.map((name) => docker(workloadArgs(config, name)))));
}

if (import.meta.main) await main();
