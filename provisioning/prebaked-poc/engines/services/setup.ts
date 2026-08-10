import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  connectDockerNetwork, discoverPmmServer, docker, envFlag, ensureDockerNetwork, installClient,
  registerPmmService, requireDockerImage, resolveClientTarball, retry, selectClientSource,
  setupPmmAgents, step, type PmmClientConfig,
} from '../../../pmm-client.ts';

type ServiceType = 'haproxy' | 'external';
interface Config extends PmmClientConfig {
  type: ServiceType; image: string; clientTarball?: string; pmmServer?: string; backends: string[];
}
const NETWORK = 'pmm-qa';
const LABEL = 'pmm-qa.poc=services-prebaked';

export function parseConfig(argv: string[] = process.argv.slice(2), env = process.env): Config {
  const { values } = parseArgs({ args: argv, strict: true, options: {
    type: { type: 'string' }, image: { type: 'string' }, 'client-tarball': { type: 'string' },
    'client-version': { type: 'string' }, 'pmm-server': { type: 'string' },
    'admin-password': { type: 'string' }, 'metrics-mode': { type: 'string' },
    'encrypted-client-config': { type: 'boolean' }, 'client-debug': { type: 'boolean' },
    backends: { type: 'string' },
  }});
  const type = (values.type ?? env.SERVICE_TYPE ?? '').toLowerCase();
  if (type !== 'haproxy' && type !== 'external') throw new Error('type must be haproxy or external');
  const rawBackends = values.backends ?? env.HAPROXY_BACKENDS;
  if (rawBackends && type !== 'haproxy') throw new Error('backends are supported by haproxy only');
  const backends = rawBackends?.split(',').map((target) => target.trim()) ?? [];
  for (const target of backends) {
    const match = /^([a-zA-Z0-9][a-zA-Z0-9_.-]*):([1-9]\d{0,4})$/.exec(target);
    if (!match || Number(match[2]) > 65_535) throw new Error(`invalid HAProxy backend: ${target}`);
  }
  const client = selectClientSource(values['client-version'] ?? env.CLIENT_VERSION, values['client-tarball'] ?? env.CLIENT_TARBALL);
  return {
    type, image: values.image ?? env.SERVICE_IMAGE ?? `pmm-qa/${type}:latest-prebaked`, ...client,
    pmmServer: values['pmm-server'] ?? env.PMM_SERVER_IP,
    adminPassword: values['admin-password'] ?? env.ADMIN_PASSWORD ?? 'admin',
    metricsMode: values['metrics-mode'] ?? env.METRICS_MODE ?? 'auto',
    encryptedClientConfig: values['encrypted-client-config'] ?? envFlag(env.ENCRYPTED_CLIENT_CONFIG),
    clientDebug: values['client-debug'] ?? envFlag(env.CLIENT_DEBUG),
    backends,
  };
}

// When `backends` (comma-separated host:port targets) is supplied, HAProxy fronts those real
// servers over a TCP frontend/backend on :3306 with health checks, in addition to the baked-in
// stats/metrics frontend. Without it, the image's baked haproxy.cfg (stats-only) is used as-is.
function renderHaproxyConfig(backends: string[]): string {
  const servers = backends
    .map((target, index) => `  server srv${index + 1} ${target} check`)
    .join('\n');
  return [
    'global',
    '  daemon',
    '',
    'defaults',
    '  timeout connect 10s',
    '  timeout client 60s',
    '  timeout server 60s',
    '',
    'frontend stats',
    '  mode http',
    '  bind *:42100',
    '  stats enable',
    '  stats uri /stats',
    '  stats refresh 10s',
    '  http-request use-service prometheus-exporter if { path /metrics }',
    '',
    'frontend mysql_front',
    '  mode tcp',
    '  bind *:3306',
    '  default_backend allservers',
    '',
    'backend allservers',
    '  mode tcp',
    '  balance roundrobin',
    '  option tcp-check',
    servers,
    '',
  ].join('\n');
}

export function serviceRunArgs(config: Config): string[] {
  const name = config.type === 'haproxy' ? 'haproxy_pmm' : 'external_pmm';
  const writeConfig = config.type === 'haproxy' && config.backends.length
    ? `cat <<'HAPROXY_CFG' > /etc/haproxy/haproxy.cfg\n${renderHaproxyConfig(config.backends)}HAPROXY_CFG\n`
    : '';
  // curl in this image has no telnet:// support (RockyLinux 9 build ships without it), so a
  // curl-based probe silently never connects; the shell's own /dev/tcp redirection opens a
  // real TCP connection through the proxy without extra tooling.
  const traffic = config.type === 'haproxy' && config.backends.length
    ? 'while :; do (exec 3<>/dev/tcp/127.0.0.1/3306) 2>/dev/null && exec 3<&- 3>&- || true; sleep 10; done & '
    : '';
  const command = config.type === 'haproxy'
    ? `${writeConfig}${traffic}exec haproxy -W -db -f /etc/haproxy/haproxy.cfg`
    : 'redis_exporter --redis.addr=redis://redis_container:6379 --redis.password=oFukiBRg7GujAJXq3tmd --web.listen-address=:42200 & exec process-exporter --web.listen-address=:9256';
  return ['run', '--detach', '--name', name, '--hostname', name, '--label', LABEL,
    '--label', `pmm-qa.service=${config.type}`, '--network', NETWORK, '--entrypoint', 'sh', config.image, '-ceu', command];
}

async function cleanup(type: ServiceType): Promise<void> {
  const ids = (await docker(['ps', '-aq', '--filter', `label=pmm-qa.service=${type}`], true)).stdout.trim().split(/\s+/).filter(Boolean);
  if (type === 'external') {
    const redis = (await docker(['ps', '-aq', '--filter', 'name=redis_container'], true)).stdout.trim();
    if (redis) ids.push(redis);
  }
  if (ids.length) await docker(['rm', '-fv', ...ids]);
}

async function main(): Promise<void> {
  const config = parseConfig();
  const name = config.type === 'haproxy' ? 'haproxy_pmm' : 'external_pmm';
  await step('Check Docker', () => docker(['info']));
  await step('Check prebaked image', () => requireDockerImage(config.image, 'npm run build'));
  await step('Clean previous run', () => cleanup(config.type));
  await step('Prepare Docker network', () => ensureDockerNetwork(NETWORK));
  if (config.type === 'external') {
    await step('Start Redis target', () => docker(['run', '--detach', '--name', 'redis_container', '--network', NETWORK, 'valkey/valkey:8-bookworm', 'valkey-server', '--requirepass', 'oFukiBRg7GujAJXq3tmd']));
  }
  await step(`Start ${config.type}`, () => docker(serviceRunArgs(config)));
  const port = config.type === 'haproxy' ? '42100' : '42200';
  await retry(`${config.type} metrics`, () => docker(['exec', name, 'curl', '-fsS', `http://127.0.0.1:${port}/metrics`], true), (result) => result.stdout.length > 0);
  const server = await step('Find PMM server', () => discoverPmmServer(config.pmmServer));
  await step('Connect PMM server to network', () => connectDockerNetwork(server, NETWORK));
  const tarball = config.clientTarball ? await resolveClientTarball(config.clientTarball) : undefined;
  await step('Install PMM client', () => installClient(config, [name], tarball));
  await step('Set up PMM agent', () => setupPmmAgents(config, [name], server));
  if (config.type === 'haproxy') {
    await step('Register HAProxy', () => registerPmmService(['exec', name, 'pmm-admin', 'add', 'haproxy', '--listen-port=42100', '--environment=haproxy', 'haproxy_service']).then(() => undefined));
  } else {
    await step('Register external exporters', () => Promise.all([
      registerPmmService(['exec', name, 'pmm-admin', 'add', 'external', '--listen-port=42200', '--group=redis', '--service-name=redis_external_service']),
      registerPmmService(['exec', name, 'pmm-admin', 'add', 'external', '--listen-port=9256', '--group=processes', '--service-name=nodeprocess_service']),
    ]).then(() => undefined));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
