import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export function envFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
}

export interface PmmClientConfig {
  clientVersion?: string;
  adminPassword: string;
  metricsMode: string;
  encryptedClientConfig: boolean;
  clientDebug: boolean;
}

type CommandResult = { stdout: string; stderr: string };

const LATEST_TARBALL_URL =
  'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz';
const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '.cache');

function commandLabel(file: string, args: string[]): string {
  return file === 'docker' ? `docker ${args[0] ?? ''}`.trim() : file;
}

function command(file: string, args: string[], allowFailure = false): Promise<CommandResult> {
  const label = commandLabel(file, args);
  const started = performance.now();
  return new Promise((resolveCommand, rejectCommand) => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const result = { stdout: String(stdout), stderr: String(stderr) };
      if (error && !allowFailure) {
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
        console.error(`[FAIL] ${label} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
        rejectCommand(
          new Error(`${label} failed\n${output}`.trim(), { cause: error }),
        );
        return;
      }
      console.log(
        `[${error ? 'WAIT' : ' OK '}] ${label} (${((performance.now() - started) / 1000).toFixed(1)}s)`,
      );
      resolveCommand(result);
    });
  });
}

export function docker(args: string[], allowFailure = false): Promise<CommandResult> {
  return command('docker', args, allowFailure);
}

export async function step<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  console.log(`\n==> ${name}`);
  try {
    const result = await operation();
    console.log(`<== ${name} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
    return result;
  } catch (error) {
    throw new Error(`step failed: ${name}`, { cause: error });
  }
}

export async function ensureDockerNetwork(network = 'pmm-qa'): Promise<void> {
  const result = await docker(['network', 'inspect', network], true);
  if (!result.stdout.trim() || result.stdout.trim() === '[]') {
    await docker(['network', 'create', network]);
  }
}

export async function requireDockerImage(image: string, buildCommand: string): Promise<void> {
  if (!(await docker(['image', 'inspect', image], true)).stdout.trim()) {
    throw new Error(`image ${image} is missing; build it with: ${buildCommand}`);
  }
}

export async function discoverPmmServer(configured?: string): Promise<string> {
  if (configured) return configured;
  const name = (
    await docker(['ps', '--filter', 'name=pmm-server', '--format', '{{.Names}}'])
  ).stdout.trim().split(/\r?\n/, 1)[0];
  if (!name) throw new Error('no PMM server found; pass --pmm-server');
  return name;
}

export async function connectDockerNetwork(name: string, network = 'pmm-qa'): Promise<void> {
  const candidate = name.replace(/^https?:\/\//, '').split(':', 1)[0];
  const result = await docker(
    ['inspect', '--format', '{{json .NetworkSettings.Networks}}', candidate],
    true,
  );
  if (result.stdout.trim() && !(network in JSON.parse(result.stdout))) {
    await docker(['network', 'connect', network, candidate]);
  }
}

export function selectClientSource(
  requestedVersion: string | undefined,
  requestedTarball: string | undefined,
  fallback: 'latest' | string = 'latest',
): Pick<PmmClientConfig, 'clientVersion'> & { clientTarball?: string } {
  if (requestedVersion && requestedTarball) {
    throw new Error('use either client version or client tarball, not both');
  }
  if (!requestedVersion && !requestedTarball) {
    return fallback === 'latest' ? { clientTarball: 'latest' } : { clientVersion: fallback };
  }
  if (requestedVersion === 'latest-tarball') return { clientTarball: 'latest' };
  if (/^https?:\/\//i.test(requestedVersion ?? '')) return { clientTarball: requestedVersion };
  return { clientVersion: requestedVersion, clientTarball: requestedTarball };
}

export async function retry<T>(
  description: string,
  operation: () => Promise<T>,
  accepts: (value: T) => boolean,
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const value = await operation();
      if (accepts(value)) return value;
    } catch (error) {
      if (!shouldRetry(error)) throw error;
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(`timed out waiting for ${description}`, { cause: lastError });
}

export function isPmmAgentConnected(status: string): boolean {
  return /\bconnected\b/i.test(status);
}

export function isPmmAgentDisconnected(error: unknown): boolean {
  return error instanceof Error && error.message.includes('pmm-agent is not connected');
}

export function registerPmmService(args: string[]): Promise<CommandResult> {
  return retry(
    `PMM service registration on ${args[1] ?? 'container'}`,
    () => docker(args),
    () => true,
    isPmmAgentDisconnected,
  );
}

export async function resolveClientTarball(
  source: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const normalized = source === 'latest' ? LATEST_TARBALL_URL : source;
  if (!/^https?:\/\//i.test(normalized)) {
    const localPath = resolve(normalized);
    if (!localPath.endsWith('.tar.gz')) throw new Error('client tarball must end in .tar.gz');
    await access(localPath);
    return localPath;
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const cacheKey = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const cached = resolve(CACHE_DIR, `pmm-client-${cacheKey}.tar.gz`);
  try {
    await access(cached);
    return cached;
  } catch {
    // Download below.
  }

  const response = await fetcher(normalized);
  if (!response.ok) throw new Error(`failed to download PMM client: HTTP ${response.status}`);
  if (!response.body) throw new Error('PMM client download returned an empty response');
  const temporary = `${cached}.tmp-${process.pid}`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, cached);
  return cached;
}

async function installClientTarball(tarball: string, names: string[]): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      await docker(['cp', tarball, `${name}:/tmp/pmm-client.tar.gz`]);
      await docker([
        'exec',
        '--user',
        'root',
        name,
        'sh',
        '-ceu',
        `rm -rf /tmp/pmm-client-extract
         mkdir -p /tmp/pmm-client-extract
         tar -xzf /tmp/pmm-client.tar.gz -C /tmp/pmm-client-extract
         installer="$(find /tmp/pmm-client-extract -type f -name install_tarball -print -quit)"
         test -n "$installer"
         cd "$(dirname "$installer")"
         bash ./install_tarball
         ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin
         ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent
         pmm-admin --version`,
      ]);
    }),
  );
}

export async function installClient(
  config: Pick<PmmClientConfig, 'clientVersion'>,
  names: string[],
  tarball?: string,
): Promise<void> {
  if (config.clientVersion) {
    const channels: Record<string, string> = {
      '3-dev-latest': 'experimental',
      'pmm3-rc': 'testing',
      'pmm3-latest': 'release',
    };
    await Promise.all(
      names.map((name) => {
        const channel = channels[config.clientVersion!];
        const install = channel
          ? `percona-release enable-only pmm3-client ${channel}
             microdnf install -y pmm-client`
          : `version=${config.clientVersion}
             build=${pmmClientBuild(config.clientVersion!)}
             os="$(. /etc/os-release; echo "\${VERSION_ID%%.*}")"
             curl -fL -o /tmp/pmm-client.rpm "https://repo.percona.com/pmm3-client/yum/release/\${os}/RPMS/x86_64/pmm-client-\${version}-\${build}.el\${os}.x86_64.rpm"
             microdnf install -y /tmp/pmm-client.rpm`;
        return docker([
          'exec',
          '--user',
          'root',
          name,
          'sh',
          '-ceu',
          `${install}
           ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin
           ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent
           pmm-admin --version`,
        ]);
      }),
    );
    return;
  }
  if (!tarball) throw new Error('client tarball is required');
  await installClientTarball(tarball, names);
}

export function pmmClientBuild(version: string): number {
  if (version === '3.7.1' || version === '3.8.0') return 8;
  if (version === '3.8.1' || Number(version.split('.')[1]) > 8) return 1;
  return 7;
}

function supportsEncryptedConfig(config: PmmClientConfig): boolean {
  if (!config.encryptedClientConfig) return false;
  if (!config.clientVersion) return true;
  if (['3-dev-latest', 'pmm3-rc', 'pmm3-latest'].includes(config.clientVersion)) return true;
  return Number(config.clientVersion.split('.')[1]) >= 7;
}

function pmmServerAddress(server: string): string {
  if (server.includes(':')) return server;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(server) ? `${server}:443` : `${server}:8443`;
}

export async function setupPmmAgents(
  config: PmmClientConfig,
  names: string[],
  server: string,
): Promise<void> {
  const encryptedClientConfig = supportsEncryptedConfig(config);
  for (const name of names) {
    const configFile = '/usr/local/percona/pmm/config/pmm-agent.yaml';
    const keyFile = '/usr/local/percona/pmm/config/pmm-key.pem';
    if (encryptedClientConfig) {
      await docker([
        'exec',
        '--user',
        'root',
        name,
        'openssl',
        'genpkey',
        '-algorithm',
        'RSA',
        '-pkeyopt',
        'rsa_keygen_bits:4096',
        '-aes256',
        '-pass',
        'pass:testpass',
        '-out',
        keyFile,
      ]);
    }

    const setupArgs = [
      'exec',
      '--user',
      'root',
      name,
      'pmm-agent',
      'setup',
      `--config-file=${configFile}`,
      `--server-address=${pmmServerAddress(server)}`,
      '--server-insecure-tls',
      `--metrics-mode=${config.metricsMode}`,
      '--server-username=admin',
      `--server-password=${config.adminPassword}`,
    ];
    if (config.clientDebug) setupArgs.push('--debug');
    setupArgs.push('--force');
    if (encryptedClientConfig) {
      setupArgs.push(
        '--custom-labels=role=pmm-client, encrypted=true, password=true',
        `--config-file-key-file=${keyFile}`,
        '--config-file-key-password=testpass',
      );
    }
    setupArgs.push(name);
    await docker(setupArgs);

    const startArgs = [
      'exec',
      '--detach',
      '--user',
      'root',
      name,
      'pmm-agent',
      `--config-file=${configFile}`,
    ];
    if (encryptedClientConfig) {
      startArgs.push(
        `--config-file-key-file=${keyFile}`,
        '--config-file-key-password=testpass',
      );
    }
    await docker(startArgs);
    await retry(
      `PMM agent on ${name}`,
      () => docker(['exec', name, 'pmm-admin', 'status'], true),
      (result) => isPmmAgentConnected(result.stdout),
    );
  }
}
