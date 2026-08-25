import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, rename, stat, unlink, utimes } from 'node:fs/promises';
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

export const PMM_CLIENT_OPTIONS = {
  'client-tarball': { type: 'string' },
  'client-version': { type: 'string' },
  'pmm-server': { type: 'string' },
  'admin-password': { type: 'string' },
  'metrics-mode': { type: 'string' },
  'encrypted-client-config': { type: 'boolean' },
  'client-debug': { type: 'boolean' },
} as const;

export function pmmClientConfig(
  values: Record<string, string | boolean | undefined>,
  env: Record<string, string | undefined>,
  fallback: 'latest' | string = 'latest',
): PmmClientConfig & { clientTarball?: string; pmmServer?: string } {
  // A flag from setup.ts wins outright rather than merging with the environment: setup.ts has
  // already resolved CLIENT_VERSION, and when that resolved to a tarball the child still inherits
  // the original CLIENT_VERSION=latest-tarball (or a URL), which would otherwise read as a second,
  // conflicting source. Only a standalone engine run, with neither flag, falls back to the
  // environment.
  const flagged = values['client-version'] !== undefined || values['client-tarball'] !== undefined;
  const requestedVersion = flagged ? values['client-version'] as string | undefined : env.CLIENT_VERSION;
  const requestedTarball = flagged ? values['client-tarball'] as string | undefined : env.CLIENT_TARBALL;
  return {
    ...selectClientSource(requestedVersion, requestedTarball, fallback),
    pmmServer: values['pmm-server'] as string | undefined ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] as string | undefined ?? env.ADMIN_PASSWORD ?? 'admin',
    metricsMode: values['metrics-mode'] as string | undefined ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig: values['encrypted-client-config'] as boolean | undefined ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] as boolean | undefined ?? envFlag(env.CLIENT_DEBUG),
  };
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

// Podman ships a docker-compatible CLI, so the runner-e2e-tests-podman job only needs a different
// binary name, not a different code path.
export const CONTAINER_RUNTIME = process.env.CONTAINER_RUNTIME ?? 'docker';

export function docker(args: string[], allowFailure = false): Promise<CommandResult> {
  return command(CONTAINER_RUNTIME, args, allowFailure);
}

export interface StepTiming {
  name: string;
  seconds: number;
}

export const stepTimings: StepTiming[] = [];

export async function step<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  console.log(`\n==> ${name}`);
  const record = (failed: boolean): string => {
    const seconds = (performance.now() - started) / 1000;
    stepTimings.push({ name: failed ? `${name} FAILED` : name, seconds });
    return seconds.toFixed(1);
  };
  try {
    const result = await operation();
    console.log(`<== ${name} (${record(false)}s)`);
    return result;
  } catch (error) {
    console.error(`<!! ${name} failed (${record(true)}s)`);
    throw error;
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
  // Match on the image, not the container name: a reused server is often named something else
  // (pmm-server-1, pmm-server-dev), and pmm-framework matched the image for exactly this reason.
  const output = (
    await docker(['ps', '--format', '{{.Image}}\t{{.Names}}'])
  ).stdout.trim();
  const names = (output ? output.split(/\r?\n/) : [])
    .map((line) => line.split('\t'))
    .filter(([image]) => image.includes('pmm-server'))
    .map(([, name]) => name);
  if (!names.length) throw new Error('no PMM server found; pass --pmm-server');
  if (names.length > 1) {
    console.warn(`multiple pmm-server containers found: ${names.join(', ')}; using ${names[0]}`);
  }
  return names[0];
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

export async function preparePmm(
  config: PmmClientConfig & { clientTarball?: string; pmmServer?: string },
  image: string,
  buildCommand: string,
): Promise<readonly [string, string | undefined]> {
  await step('Check database image', () => requireDockerImage(image, buildCommand));
  await step('Prepare Docker network', () => ensureDockerNetwork());
  const server = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(server));
  const tarball = config.clientTarball ? await resolveClientTarball(config.clientTarball) : undefined;
  return [server, tarball];
}

export async function configurePmm(
  config: PmmClientConfig,
  names: string[],
  server: string,
  tarball?: string,
): Promise<void> {
  await step('Wait for PMM Server', () => waitForPmmServerReady(server));
  await step('Install PMM client', () => installClient(config, names, tarball));
  await step('Set up PMM agents', () => setupPmmAgents(config, names, server));
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

function lastOutput(value: unknown): string {
  if (value instanceof Error) return value.message.trim().slice(-400);
  if (typeof value === 'string') return value.trim().slice(-400);
  if (value && typeof value === 'object') {
    const { stdout, stderr } = value as { stdout?: unknown; stderr?: unknown };
    return `${String(stdout ?? '')}${String(stderr ?? '')}`.trim().slice(-400);
  }
  return '';
}

export async function retry<T>(
  description: string,
  operation: () => Promise<T>,
  accepts: (value: T) => boolean,
  shouldRetry: (error: unknown) => boolean = () => true,
  attempts = 60,
  pause: (milliseconds: number) => Promise<unknown> = sleep,
): Promise<T> {
  let lastError: unknown;
  let lastValue: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await operation();
      if (accepts(value)) return value;
      lastValue = value;
    } catch (error) {
      if (!shouldRetry(error)) throw error;
      lastError = error;
    }
    await pause(1000);
  }
  // A rejected attempt keeps its error, but an attempt that merely failed `accepts` used to be
  // discarded -- leaving "timed out waiting for X" with no trace of what the command actually said.
  const detail = lastOutput(lastError ?? lastValue);
  throw new Error(
    `timed out waiting for ${description}${detail ? `; last output: ${detail}` : ''}`,
    { cause: lastError ?? lastValue },
  );
}

export function isPmmAgentConnected(status: string): boolean {
  return /\bconnected\b/i.test(status);
}

export function isPmmAgentDisconnected(error: unknown): boolean {
  return error instanceof Error && error.message.includes('pmm-agent is not connected');
}

// A just-booted PMM Server can refuse or drop an early registration. Retry those transient
// failures; a real misconfiguration (bad password, wrong address) still fails on the first attempt.
export function isTransientServerError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(connection refused|connection reset|no such host|timeout|timed out|\bEOF\b|handshake|internal server error|50[0234])/i.test(
      error.message,
    )
  );
}

type DockerCommand = (args: string[], allowFailure?: boolean) => Promise<CommandResult>;

export function waitForPmmExporter(
  container: string,
  exporter: string,
  execute: DockerCommand = docker,
): Promise<CommandResult> {
  return retry(
    `${exporter} on ${container}`,
    () => execute(['exec', container, 'pmm-admin', 'status'], true),
    ({ stdout }) =>
      stdout
        .split(/\r?\n/)
        .some((line) => line.includes(exporter) && /\b(running|waiting)\b/i.test(line)),
  );
}

// Building the database needs no PMM Server, so setup.ts only creates the container and every
// engine waits here instead -- immediately before its first server call -- which overlaps the
// server's boot with the database build. An external --pmm-server host cannot be inspected, so it
// is assumed ready, exactly as it was before.
export async function waitForPmmServerReady(
  server: string,
  execute: DockerCommand = docker,
  pause: (milliseconds: number) => Promise<unknown> = sleep,
): Promise<void> {
  const container = server.replace(/^https?:\/\//, '').split(':')[0];
  const state = (): Promise<CommandResult> =>
    execute(['inspect', '--format', '{{.State.Running}}', container], true);
  if (!(await state()).stdout.trim()) return;
  await retry(
    `PMM Server ${container} readiness`,
    async () => {
      // A container that died mid-boot will never become ready; fail now instead of polling it out.
      if ((await state()).stdout.trim() === 'false') {
        throw new Error(`PMM Server container ${container} is not running`);
      }
      return execute(['exec', container, 'curl', '-fsS', 'http://127.0.0.1:8080/v1/server/readyz'], true);
    },
    (result) => result.stdout.trim().length > 0,
    (error) => !(error instanceof Error && error.message.includes('is not running')),
    180,
    pause,
  );
}

export function registerPmmService(args: string[]): Promise<CommandResult> {
  return retry(
    `PMM service registration on ${args[1] ?? 'container'}`,
    () => docker(args),
    () => true,
    isPmmAgentDisconnected,
  );
}

// The URLs that matter most -- pmm-client-latest.tar.gz and the per-OL dynamic builds -- are
// moving targets, but the cache is keyed on a hash of the URL. Returning a hit unconditionally
// therefore pinned whatever was downloaded first: a run asking for `latest` would keep testing a
// weeks-old client forever, and say nothing.
//
// The cached file's own mtime is the validation timestamp, so no sidecar state is needed: 304
// means it is still current (and we stamp it as validated now), 200 means it moved and we take
// the new body, and an unreachable build cache falls back to what we already have rather than
// failing a run that could otherwise proceed.
//
// Returns a response whose body should replace the cache, or undefined to keep the cached file.
async function revalidateCachedTarball(
  url: string,
  cached: string,
  fetcher: typeof fetch,
): Promise<Response | undefined> {
  const keepCached = async (note?: string): Promise<undefined> => {
    if (note) console.warn(note);
    const now = new Date();
    await utimes(cached, now, now);
    return undefined;
  };
  let response: Response;
  try {
    const { mtime } = await stat(cached);
    response = await fetcher(url, { headers: { 'If-Modified-Since': mtime.toUTCString() } });
  } catch {
    return keepCached(`could not reach ${url}; using the cached PMM client tarball`);
  }
  if (response.status === 304) return keepCached();
  if (!response.ok) {
    return keepCached(`revalidating ${url} returned HTTP ${response.status}; using the cached PMM client tarball`);
  }
  return response;
}

// One entry accumulates per distinct URL -- every feature-branch build gets its own -- and each is
// around 180MB, so without this the directory grows without bound. Age, not count: an entry is
// re-stamped every time it is used or revalidated, so only genuinely abandoned builds expire, and
// nothing from a run in progress can be removed.
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function pruneClientTarballCache(
  keep: string,
  directory = CACHE_DIR,
  now = Date.now(),
): Promise<string[]> {
  const removed: string[] = [];
  try {
    const cutoff = now - CACHE_MAX_AGE_MS;
    await Promise.all((await readdir(directory))
      .filter((name) => /^pmm-client-[0-9a-f]{16}\.tar\.gz$/.test(name))
      .map(async (name) => {
        const path = resolve(directory, name);
        if (path === keep) return;
        if ((await stat(path)).mtimeMs >= cutoff) return;
        await unlink(path);
        removed.push(path);
      }));
  } catch {
    // A cache that cannot be pruned is not a reason to fail provisioning.
  }
  return removed;
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
  const isCached = await access(cached).then(() => true, () => false);
  let response = isCached ? await revalidateCachedTarball(normalized, cached, fetcher) : undefined;
  if (isCached && !response) return cached;

  response ??= await fetcher(normalized);
  if (!response.ok) throw new Error(`failed to download PMM client: HTTP ${response.status}`);
  if (!response.body) throw new Error('PMM client download returned an empty response');
  const temporary = `${cached}.tmp-${process.pid}`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, cached);
  const removed = await pruneClientTarballCache(cached);
  if (removed.length) console.log(`pruned ${removed.length} client tarball(s) unused for 14 days`);
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

// A container on our own network answers on 8443; anything else is a host or proxy address and
// answers on 443, matching pmm-framework's --pmm-server-ip. Asking Docker beats guessing from the
// shape of the string, which sent a PMM reached by DNS name to the wrong port.
export async function pmmServerAddress(server: string, execute: DockerCommand = docker): Promise<string> {
  if (server.includes(':')) return server;
  const running = (await execute(['inspect', '--format', '{{.State.Running}}', server], true)).stdout.trim();
  return `${server}:${running === 'true' ? '8443' : '443'}`;
}

export async function setupPmmAgents(
  config: PmmClientConfig,
  names: string[],
  server: string,
  execute: DockerCommand = docker,
  pause: (milliseconds: number) => Promise<unknown> = sleep,
): Promise<void> {
  const encryptedClientConfig = supportsEncryptedConfig(config);
  let registrationQueue: Promise<unknown> = Promise.resolve();
  const setupAgent = async (name: string): Promise<void> => {
    const configFile = '/usr/local/percona/pmm/config/pmm-agent.yaml';
    const keyFile = '/usr/local/percona/pmm/config/pmm-key.pem';
    if (encryptedClientConfig) {
      await execute([
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
      `--server-address=${await pmmServerAddress(server, execute)}`,
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
    // pmm-managed 3.9.1 can return 500 when a cold server receives registrations together.
    // Serialize only this call; agent startup and connection checks can still overlap.
    const registration = registrationQueue.then(() =>
      retry(
        `PMM agent setup on ${name}`,
        () => execute(setupArgs),
        () => true,
        isTransientServerError,
        10,
        pause,
      ));
    registrationQueue = registration.catch(() => undefined);
    await registration;

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
    await execute(startArgs);
    await retry(
      `PMM agent on ${name}`,
      () => execute(['exec', name, 'pmm-admin', 'status'], true),
      (result) => isPmmAgentConnected(result.stdout),
      () => true,
      60,
      pause,
    );
  };

  if (!names.length) return;
  const results = await Promise.allSettled(names.map(setupAgent));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failures.length) {
    throw new AggregateError(failures.map(({ reason }) => reason), `${failures.length} of ${names.length} PMM agent setup(s) failed`);
  }
}
