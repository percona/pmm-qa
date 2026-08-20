import { parseArgs } from 'node:util';
import {
  configurePmm,
  docker,
  envFlag,
  PMM_CLIENT_OPTIONS,
  pmmClientConfig,
  preparePmm,
  registerPmmService,
  retry,
  step,
  type PmmClientConfig,
  waitForPmmExporter,
} from '../../../pmm-client.ts';

export type MlaunchEngine = 'psmdb' | 'mongodb';
export type Version = '6.0' | '7.0' | '8.0';
export type SetupType = 'single' | 'pss';

export interface Config extends PmmClientConfig {
  engine: MlaunchEngine;
  version: Version;
  image: string;
  setupType: SetupType;
  clientTarball?: string;
  pmmServer?: string;
  tls: boolean;
}

const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.engine=mlaunch';
const PORT = 27017;

export function containerName(engine: MlaunchEngine, version: Version, setupType: SetupType): string {
  const topology = setupType === 'single' ? '' : `_${setupType}`;
  return `mlaunch_${engine}${topology}_${version.replace('.', '_')}`;
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
      ...PMM_CLIENT_OPTIONS,
      tls: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`Usage: node setup.ts [options]

  --engine psmdb|mongodb
  --version 6.0|7.0|8.0
  --setup-type single|pss
  --client-version VERSION
  --client-tarball latest|PATH|URL
  --pmm-server HOST[:PORT]
  --admin-password PASSWORD
  --tls (psmdb only)
  --client-debug`);
    process.exit(0);
  }

  const engine = (values.engine ?? env.MLAUNCH_ENGINE ?? 'psmdb').toLowerCase();
  if (engine !== 'psmdb' && engine !== 'mongodb') throw new Error('engine must be psmdb or mongodb');
  const version = values.version ?? env.MLAUNCH_VERSION ?? '8.0';
  if (!['6.0', '7.0', '8.0'].includes(version)) throw new Error('version must be 6.0, 7.0, or 8.0');
  const setupType = (values['setup-type'] ?? env.MLAUNCH_SETUP_TYPE ?? 'pss').toLowerCase();
  if (setupType !== 'single' && setupType !== 'pss') throw new Error('setup type must be single or pss');
  const tls = values.tls ?? envFlag(env.TLS);
  if (tls && engine !== 'psmdb') throw new Error('tls is supported on psmdb only');

  return {
    engine,
    version: version as Version,
    image: values.image ?? env.MLAUNCH_IMAGE ?? `pmm-qa/mlaunch-${engine}:${version}`,
    setupType: setupType as SetupType,
    ...pmmClientConfig(values, {
      ...env,
      CLIENT_VERSION: env.PMM_CLIENT_VERSION ?? env.CLIENT_VERSION,
      PMM_SERVER_IP: env.PMM_SERVER_CONTAINER_ADDRESS ?? env.PMM_SERVER_IP,
    }, '3-dev-latest'),
    tls,
  };
}

export function mlaunchInitCommand(config: Pick<Config, 'setupType' | 'tls'>): string {
  const topologyArgs = config.setupType === 'single' ? ['--single'] : ['--replicaset', '--nodes', '3'];
  const args = ['mlaunch', 'init', ...topologyArgs, '--port', String(PORT), '--auth', '--bind_ip', '0.0.0.0', '--dir', '/data/db'];
  if (config.tls) {
    args.push(
      '--sslMode', 'allowSSL',
      '--sslPEMKeyFile', '/etc/mongodb.pem',
      '--sslCAFile', '/etc/mongodb-ca.crt',
    );
  }
  return args.join(' ');
}

async function mongo(name: string, javascript: string, allowFailure = false) {
  return docker(
    ['exec', name, 'mongosh', '--quiet', `--port=${PORT}`, '--eval', javascript],
    allowFailure,
  );
}

async function waitForReady(name: string): Promise<void> {
  await retry(
    `mlaunch on ${name}`,
    () => mongo(name, 'db.adminCommand({ping: 1}).ok', true),
    (result) => result.stdout.trim().endsWith('1'),
  );
}

async function startContainer(config: Config, name: string): Promise<void> {
  await docker([
    'run',
    '--detach',
    '--name',
    name,
    '--hostname',
    name,
    '--label',
    LABEL,
    '--label',
    `pmm-qa.mlaunch.setup-type=${config.setupType}`,
    '--network',
    NETWORK,
    '--entrypoint',
    'sleep',
    config.image,
    'infinity',
  ]);
}

async function launch(config: Config, name: string): Promise<void> {
  await docker(['exec', name, 'sh', '-ceu', mlaunchInitCommand(config)]);
  await waitForReady(name);
}

async function registerWithPmm(config: Config, name: string): Promise<void> {
  const args = [
    'exec',
    name,
    'pmm-admin',
    'add',
    'mongodb',
    '--enable-all-collectors',
    `--environment=mlaunch-${config.engine}-dev`,
    `--cluster=mlaunch-${config.setupType}`,
    '--host=127.0.0.1',
    `--port=${PORT}`,
    // mlaunchInitCommand runs `mlaunch init --auth` with no --username/--password,
    // so mlaunch falls back to its own documented default admin credentials.
    '--username=user',
    '--password=password',
  ];
  if (config.tls) args.push('--tls', '--tls-skip-verify');
  await registerPmmService(args);
  await waitForPmmExporter(name, 'mongodb_exporter');
}

async function main(): Promise<void> {
  const started = performance.now();
  const config = parseConfig();
  const name = containerName(config.engine, config.version, config.setupType);
  await step('Check Docker', () => docker(['info']));
  const [pmmServer, tarball] = await preparePmm(config, config.image, `npm run build -- mlaunch-${config.engine}=${config.version}`);
  await step('Clean previous run', () => docker(['rm', '-fv', name], true));
  await step('Start mlaunch container', () => startContainer(config, name));
  await step(`Launch ${config.setupType} MongoDB topology via mlaunch`, () => launch(config, name));
  await configurePmm(config, [name], pmmServer, tarball);
  await step(`Register ${config.engine} with PMM`, () => registerWithPmm(config, name));
  console.log(`total: ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
