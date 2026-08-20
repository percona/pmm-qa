import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const provisioningPath = (...parts: string[]) => resolve(fileURLToPath(new URL('.', import.meta.url)), ...parts);
import {
  backendTargets,
  childStepTimings,
  collectDiagnostics,
  createServer,
  databaseArchive,
  databaseImage,
  ensureDocker,
  formatStepSummary,
  importantLineEcho,
  orchestrate,
  parseConfig,
  parseDatabase,
  provisionDatabases,
  provisionerArgs,
  reportProvisionResult,
  resolveClientArgs,
  serverImageFreshness,
  teardown,
  teardownContainerIds,
  teardownVolumeNames,
  waitForServer,
  type CommandResult,
  type Runner,
} from './setup.ts';

test('parses server-only defaults without a database', () => {
  assert.deepEqual(parseConfig([], {}), {
    databases: [],
    serverImage: 'perconalab/pmm-server:3-dev-latest',
    serverPort: '443',
    serverEnv: [],
    watchtower: false,
    pmmServer: undefined,
    adminPassword: 'admin',
    clientVersion: 'latest-tarball',
    metricsMode: 'auto',
    clientDebug: false,
    encryptedClientConfig: false,
    reuseServer: false,
    sequential: false,
    verbose: false,
    teardown: false,
    help: false,
  });
  assert.deepEqual(
    parseConfig([
      '--server-image',
      'perconalab/pmm-server-fb:PR-123-deadbeef',
      '--admin-password',
      'secret',
    ], {}),
    {
      databases: [],
      serverImage: 'perconalab/pmm-server-fb:PR-123-deadbeef',
      serverPort: '443',
      serverEnv: [],
      watchtower: false,
      pmmServer: undefined,
      adminPassword: 'secret',
      clientVersion: 'latest-tarball',
      metricsMode: 'auto',
      clientDebug: false,
      encryptedClientConfig: false,
      reuseServer: false,
      sequential: false,
      verbose: false,
      teardown: false,
      help: false,
    },
  );
});

test('parses --reuse-server, --sequential, and --verbose flags', () => {
  const defaults = parseConfig([]);
  assert.equal(defaults.reuseServer, false);
  assert.equal(defaults.sequential, false);
  assert.equal(defaults.verbose, false);
  const config = parseConfig(['--reuse-server', '--sequential', '--verbose']);
  assert.equal(config.reuseServer, true);
  assert.equal(config.sequential, true);
  assert.equal(config.verbose, true);
});

test('parses database defaults together', () => {
  const config = parseConfig([
    '--db', 'mysql', '--db', 'ps', '--db', 'pxc', '--db', 'psmdb', '--db', 'mongodb', '--db', 'pgsql', '--db', 'pdpgsql', '--db', 'client',
  ]);
  assert.deepEqual(
    config.databases.map(({ type, version, options }) => ({ type, version, options })),
    [
      { type: 'mysql', version: '9.7', options: {} },
      { type: 'ps', version: '8.0', options: {} },
      { type: 'pxc', version: '8.0', options: {} },
      { type: 'psmdb', version: '8.0', options: {} },
      { type: 'mongodb', version: '8.0', options: {} },
      { type: 'pgsql', version: '18', options: {} },
      { type: 'pdpgsql', version: '18', options: {} },
      { type: 'client', version: 'latest', options: {} },
    ],
  );
  assert.equal(config.serverImage, 'perconalab/pmm-server:3-dev-latest');
  assert.equal(config.adminPassword, 'admin');
  assert.equal(config.clientVersion, 'latest-tarball');
});

test('parses explicit database descriptors', () => {
  assert.equal(parseDatabase('mysql=5.7').version, '5.7');
  assert.equal(parseDatabase('mysql=9.7,setup-type=gr').version, '9.7');
  const ps = parseDatabase(
    'ps=8.0,setup-type=gr,nodes=3,query-source=slowlog,workload-seconds=30,backup=true',
  );
  assert.equal(ps.version, '8.0');
  assert.equal(ps.options['setup-type'], 'gr');
  assert.equal(ps.options['query-source'], 'slowlog');
  assert.equal(ps.options.backup, 'true');

  const psmdb = parseDatabase('psmdb=7.0,setup-type=psa,storage-engine=inMemory');
  assert.equal(psmdb.options['storage-engine'], 'inMemory');
  assert.equal(parseDatabase('psmdb=latest').version, '8.0');
  assert.ok(provisionerArgs(parseDatabase('psmdb=8.0,compose-profiles=extra'), []).includes('2'));

  const pdpgsql = parseDatabase('pdpgsql=18,setup-type=patroni,nodes=5');
  assert.equal(pdpgsql.options['setup-type'], 'patroni');
  assert.equal(pdpgsql.options.nodes, '5');
  assert.equal(parseDatabase('pxc=8.0,nodes=5').options.nodes, '5');
  assert.equal(parseDatabase('pgsql=17,setup-type=replication').version, '17');
  assert.equal(parseDatabase('ssl_mysql=8.4').options.tls, 'true');
  assert.equal(parseDatabase('ssl-psmdb=8.0').options.tls, 'true');
  assert.equal(parseDatabase('ssl_pdpgsql=18').options.tls, 'true');
  assert.equal(parseDatabase('mongodb=7.0,setup-type=sharding').version, '7.0');
});

test('accepts client versions and tarball links through --client-version', async () => {
  const url = 'https://example.test/pmm-client.tar.gz';
  assert.equal(parseConfig(['--db', 'ps', '--client-version', url]).clientVersion, url);
  assert.deepEqual(await resolveClientArgs(url, async (source) => `cached:${source}`), [
    '--client-tarball',
    `cached:${url}`,
  ]);
  assert.deepEqual(await resolveClientArgs('3.9.1'), ['--client-version', '3.9.1']);
  assert.throws(() => parseConfig(['--db', 'ps', '--client-version', '3']), /client version must be/);
});

test('parses descriptors generically and forwards engine options', () => {
  assert.throws(() => parseConfig(['--db', 'ps', '--db', 'ps=8.0']), /only once/);
  assert.throws(() => parseDatabase('unknown'), /unknown provisioning type/);
  assert.throws(() => parseDatabase('ps=8.0,bad'), /invalid ps option/);
  assert.throws(() => parseDatabase('ps=9.0'), /version must be/);
  assert.ok(provisionerArgs(parseDatabase('ps=8.0,unknown=yes'), []).includes('--unknown'));
  assert.equal(parseDatabase('pdpgsql=17').version, '17');
});

test('maps archives, images, and provisioner arguments', () => {
  const client = parseDatabase('client');
  const clientArgs = provisionerArgs(
    client,
    ['--client-version', '3.9.1'],
    'secret',
    false,
    false,
    'pmm-server',
    'no',
  );
  assert.equal(databaseImage(client), 'pmm-qa/client:latest');
  assert.ok(clientArgs[0].endsWith(provisioningPath('images', 'engines', 'services', 'setup.ts')));
  assert.deepEqual(clientArgs.slice(1), [
    '--type', 'client', '--image', 'pmm-qa/client:latest',
    '--pmm-server', 'pmm-server', '--admin-password', 'secret',
    '--client-version', '3.9.1', '--metrics-mode', 'no',
  ]);

  const mysql = parseDatabase('mysql=9.7,setup-type=replication');
  assert.ok(provisionerArgs(mysql, [])[0].endsWith(provisioningPath('images', 'setup.ts')));
  assert.ok(provisionerArgs(mysql, []).includes('mysql'));

  const ps = parseDatabase('ps=8.4,setup-type=gr,query-source=slowlog,backup=true');
  assert.equal(databaseImage(ps), 'pmm-qa/ps:8.4');
  assert.equal(databaseArchive(ps), provisioningPath('images', 'ps8.4.tar.gz'));
  const psArgs = provisionerArgs(ps, ['--client-tarball', 'C:\\cache\\client.tar.gz']);
  assert.ok(psArgs[0].endsWith(provisioningPath('images', 'setup.ts')));
  assert.ok(psArgs.includes('slowlog'));
  assert.ok(psArgs.includes('--backup'));

  const psmdb = parseDatabase('psmdb=8.0');
  assert.equal(databaseImage(psmdb), 'pmm-qa/psmdb:8.0');
  assert.equal(databaseArchive(psmdb), provisioningPath('images', 'psmdb8.0.tar.gz'));
  assert.ok(
    provisionerArgs(psmdb, ['--client-version', '3.9.1'])[0].endsWith(
      provisioningPath('images', 'engines', 'psmdb', 'setup.ts'),
    ),
  );

  const pdpgsql = parseDatabase('pdpgsql=18,setup-type=replication,nodes=4');
  assert.equal(databaseImage(pdpgsql), 'pmm-qa/pdpgsql:18');
  assert.equal(databaseArchive(pdpgsql), provisioningPath('images', 'pdpgsql18.tar.gz'));
  const pdpgsqlArgs = provisionerArgs(pdpgsql, ['--client-version', '3.9.1']);
  assert.ok(
    pdpgsqlArgs[0].endsWith(
      provisioningPath('images', 'engines', 'pdpgsql', 'setup.ts'),
    ),
  );
  assert.ok(pdpgsqlArgs.includes('replication'));
  assert.ok(pdpgsqlArgs.includes('4'));

  const pgsqlArgs = provisionerArgs(parseDatabase('pgsql=18,setup-type=replication'), []);
  assert.ok(pgsqlArgs[0].endsWith(provisioningPath('images', 'engines', 'pgsql', 'setup.ts')));

  const pxc = parseDatabase('pxc=8.0,nodes=3');
  const pxcArgs = provisionerArgs(pxc, [], 'admin', true, true);
  assert.ok(
    pxcArgs[0].endsWith(provisioningPath('images', 'engines', 'pxc', 'setup.ts')),
  );
  assert.ok(pxcArgs.includes('--client-debug'));
  assert.ok(pxcArgs.includes('--encrypted-client-config'));
});

test('computes real backend targets for haproxy from sibling databases', () => {
  assert.deepEqual(backendTargets([parseDatabase('pxc=8.0,nodes=3')]), [
    'pxc_pmm_1:3306',
    'pxc_pmm_2:3306',
    'pxc_pmm_3:3306',
  ]);
  assert.deepEqual(backendTargets([parseDatabase('ps=8.0')]), ['ps_pmm_8_0_1:3306']);
  assert.deepEqual(backendTargets([parseDatabase('haproxy')]), []);
});

test('haproxy provisioning wires --backends from sibling PS/PXC databases', () => {
  const databases = [parseDatabase('haproxy'), parseDatabase('ps=8.0'), parseDatabase('pxc=8.0,nodes=3')];
  const haproxy = databases[0];
  const args = provisionerArgs(haproxy, [], 'admin', false, false, 'pmm-server', 'auto', databases);
  const backendsIndex = args.indexOf('--backends');
  assert.ok(backendsIndex !== -1);
  assert.equal(
    args[backendsIndex + 1],
    'ps_pmm_8_0_1:3306,pxc_pmm_1:3306,pxc_pmm_2:3306,pxc_pmm_3:3306',
  );

  const solo = provisionerArgs(haproxy, [], 'admin', false, false, 'pmm-server', 'auto', [haproxy]);
  assert.ok(!solo.includes('--backends'));
});

test('parses mlaunch descriptors including the ssl_ TLS alias', () => {
  assert.deepEqual(parseDatabase('mlaunch-psmdb').options, {});
  assert.equal(parseDatabase('mlaunch_psmdb=7.0').version, '7.0');
  const tls = parseDatabase('ssl_mlaunch-psmdb=8.0');
  assert.equal(tls.type, 'mlaunch-psmdb');
  assert.equal(tls.options.tls, 'true');
  assert.equal(parseDatabase('mlaunch-mongodb=6.0,setup-type=single').options['setup-type'], 'single');
});

test('maps provisioner arguments for mlaunch', () => {
  const mlaunchPsmdb = parseDatabase('mlaunch-psmdb=8.0,tls=true');
  const mlaunchArgs = provisionerArgs(mlaunchPsmdb, ['--client-tarball', 'client.tar.gz']);
  assert.ok(
    mlaunchArgs[0].endsWith(provisioningPath('images', 'engines', 'mlaunch', 'setup.ts')),
  );
  assert.ok(mlaunchArgs.includes('psmdb'));
  assert.ok(mlaunchArgs.includes('--tls'));

  const mlaunchMongodb = parseDatabase('mlaunch-mongodb=8.0');
  const mongoArgs = provisionerArgs(mlaunchMongodb, []);
  assert.ok(mongoArgs.includes('mongodb'));
  assert.ok(!mongoArgs.includes('--tls'));
});

test('requires Docker to be running', async () => {
  const runner: Runner = async () => ({ code: 1, stdout: '', stderr: '' });
  await assert.rejects(() => ensureDocker(runner), /Docker is not running/);
});

test('rejects invalid engine options before starting Docker', async () => {
  let called = false;
  await assert.rejects(
    () => orchestrate(parseConfig(['--db', 'pxc=8.0,nodes=2']), async () => {
      called = true;
      return { code: 0, stdout: '', stderr: '' };
    }),
    /at least 3/,
  );
  assert.equal(called, false);
});

test('recreates and waits for PMM Server', async () => {
  const calls: string[][] = [];
  let readinessChecks = 0;
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    calls.push([file, ...args]);
    if (args[0] === 'network' && args[1] === 'inspect') {
      return { code: 1, stdout: '', stderr: '' };
    }
    if (args[0] === 'exec') {
      readinessChecks += 1;
      return { code: readinessChecks === 1 ? 1 : 0, stdout: '', stderr: '' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };

  await createServer(
    { serverImage: 'perconalab/pmm-server:3-dev-latest', adminPassword: 'secret', serverPort: '443', serverEnv: [], watchtower: false },
    runner,
  );
  await waitForServer(runner, async () => undefined);

  assert.deepEqual(calls[0], ['docker', 'rm', '-f', 'pmm-server', 'watchtower']);
  assert.ok(calls.some((call) => call.join(' ').includes('volume rm -f pmm-data')));
  assert.ok(calls.some((call) => call.join(' ').includes('network create pmm-qa')));
  assert.ok(calls.some((call) => call.includes('GF_SECURITY_ADMIN_PASSWORD=secret')));
  assert.equal(readinessChecks, 2);
});

test('pulls the server image unless the local digest matches the registry', async () => {
  const digests = (localDigest: string, remote: CommandResult): Runner =>
    async (_file, args): Promise<CommandResult> => {
      if (args[0] === 'image') return { code: 0, stdout: `perconalab/pmm-server@${localDigest}\n`, stderr: '' };
      if (args[0] === 'buildx') return remote;
      return { code: 0, stdout: '', stderr: '' };
    };
  const remote = { code: 0, stdout: 'sha256:aaa\n', stderr: '' };
  const image = 'perconalab/pmm-server:3-dev-latest';
  assert.equal(await serverImageFreshness(image, digests('sha256:aaa', remote)), 'current');
  assert.equal(await serverImageFreshness(image, digests('sha256:bbb', remote)), 'stale');
  assert.equal(
    await serverImageFreshness(image, digests('sha256:aaa', { code: 1, stdout: '', stderr: 'no network' })),
    'unknown',
  );
  assert.equal(
    await serverImageFreshness(image, async () => ({ code: 1, stdout: '', stderr: 'no such image' })),
    'stale',
  );

  const pulls: string[][] = [];
  const runner: Runner = async (_file, args): Promise<CommandResult> => {
    if (args[0] === 'pull') pulls.push(args);
    if (args[0] === 'image') return { code: 0, stdout: 'perconalab/pmm-server@sha256:aaa\n', stderr: '' };
    if (args[0] === 'buildx') return { code: 0, stdout: 'sha256:aaa\n', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
  await createServer(
    { serverImage: image, adminPassword: 'admin', serverPort: '443', serverEnv: [], watchtower: false },
    runner,
  );
  assert.deepEqual(pulls, []);
});

test('spawns the database provisioners without waiting for server readiness', async () => {
  const order: string[] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') order.push('server created');
    if (file === 'docker' && args[0] === 'exec') order.push('readiness check');
    if (file === process.execPath) order.push('provisioner');
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(parseConfig(['--db', 'ps']), runner, async () => 'client.tar.gz');
  assert.deepEqual(order, ['server created', 'provisioner']);
});

test('a server-only run still waits for readiness itself', async () => {
  const order: string[] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') order.push('server created');
    if (file === 'docker' && args[0] === 'exec') order.push('readiness check');
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(parseConfig([]), runner, async () => 'client.tar.gz');
  assert.deepEqual(order, ['server created', 'readiness check']);
});

test('accepts distinct database topologies together', () => {
  const config = parseConfig([
    '--db',
    'pdpgsql=18,setup-type=patroni',
    '--db',
    'pdpgsql=18,setup-type=replication',
    '--db',
    'ps=8.4,setup-type=single',
    '--db',
    'ps=8.4,setup-type=replication',
    '--db',
    'psmdb=8.0,setup-type=pss',
    '--db',
    'psmdb=8.0,setup-type=sharding',
  ]);
  assert.deepEqual(
    config.databases.map(({ type, options }) => `${type}:${options['setup-type']}`),
    [
      'pdpgsql:patroni',
      'pdpgsql:replication',
      'ps:single',
      'ps:replication',
      'psmdb:pss',
      'psmdb:sharding',
    ],
  );
  const ol8 = parseDatabase('psmdb=8.0,ol-version=8');
  assert.equal(databaseImage(ol8), 'pmm-qa/psmdb:8.0-ol8');
  assert.equal(databaseArchive(ol8), provisioningPath('images', 'psmdb8.0-ol8.tar.gz'));
  assert.ok(provisionerArgs(parseDatabase('psmdb=8.0,replica-sets=2'), []).includes('2'));
  assert.throws(
    () => parseConfig(['--db', 'pdpgsql=18', '--db', 'pdpgsql=18']),
    /only once/,
  );
});

test('provisions database types concurrently after loading their images', async () => {
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const runner: Runner = async (file): Promise<CommandResult> => {
    if (file !== process.execPath) return { code: 0, stdout: '', stderr: '' };
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => releases.push(resolve));
    active -= 1;
    return { code: 0, stdout: '', stderr: '' };
  };
  const run = orchestrate(
    parseConfig(['--db', 'ps', '--db', 'psmdb']),
    runner,
    async () => 'client.tar.gz',
  );

  while (releases.length < 2) await new Promise((resolve) => setImmediate(resolve));
  releases.forEach((release) => release());
  await run;

  assert.equal(peak, 2);
});

test('--sequential forces provisioning jobs to run one at a time', async () => {
  let active = 0;
  let peak = 0;
  const runner: Runner = async (file): Promise<CommandResult> => {
    if (file !== process.execPath) return { code: 0, stdout: '', stderr: '' };
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((r) => setImmediate(r));
    active -= 1;
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(
    parseConfig(['--db', 'ps', '--db', 'psmdb', '--sequential']),
    runner,
    async () => 'client.tar.gz',
  );
  assert.equal(peak, 1);
});

test('provisionDatabases lets every job finish even when one rejects', async () => {
  const finished: string[] = [];
  const databases = [
    { type: 'ps', version: '8.0', options: {} },
    { type: 'pxc', version: '8.0', options: {} },
    { type: 'psmdb', version: '8.0', options: {} },
  ] as never[];
  const provisionOne = async (database: { type: string }): Promise<void> => {
    if (database.type === 'pxc') throw new Error('pxc failed');
    finished.push(database.type);
  };
  await assert.rejects(
    () => provisionDatabases(databases, provisionOne, false),
    /1 of 3 database provisioning job\(s\) failed/,
  );
  assert.deepEqual(new Set(finished), new Set(['ps', 'psmdb']));
});

test('reportProvisionResult logs a one-line summary on quiet success', () => {
  const messages: string[] = [];
  const original = console.log;
  console.log = (message?: unknown) => messages.push(String(message));
  try {
    reportProvisionResult('PS 8.0', { code: 0, stdout: 'lots of output', stderr: '' }, false, true);
  } finally {
    console.log = original;
  }
  assert.deepEqual(messages, ['[PS 8.0] OK']);
});

test('reportProvisionResult dumps buffered output on verbose success and on failure', () => {
  const written: string[] = [];
  const originalOut = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    written.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    reportProvisionResult('PS 8.0', { code: 0, stdout: 'verbose output', stderr: '' }, true, true);
    assert.ok(written.includes('verbose output'));
    written.length = 0;
    reportProvisionResult('PS 8.0', { code: 1, stdout: 'failure output', stderr: '' }, false, true);
    assert.ok(written.includes('failure output'));
  } finally {
    process.stdout.write = originalOut;
  }
});

test('reportProvisionResult never re-dumps output that already streamed live (not buffered)', () => {
  const written: string[] = [];
  const messages: string[] = [];
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalLog = console.log;
  process.stdout.write = ((chunk: string) => {
    written.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  console.log = (message?: unknown) => messages.push(String(message));
  try {
    reportProvisionResult('PS 8.0', { code: 1, stdout: 'already printed live', stderr: '' }, false, false);
  } finally {
    process.stdout.write = originalOut;
    console.log = originalLog;
  }
  assert.deepEqual(written, []);
  assert.deepEqual(messages, ['[PS 8.0] FAILED']);
});

test('orchestrate discovers and reuses an existing PMM Server with --reuse-server', async () => {
  let serverStarted = false;
  let connected = '';
  let provisionerServer = '';
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverStarted = true;
    if (file === process.execPath) provisionerServer = args[args.indexOf('--pmm-server') + 1];
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(
    parseConfig(['--db', 'ps', '--reuse-server']),
    runner,
    async () => 'client.tar.gz',
    async () => 'pmm-server-discovered',
    async (name) => {
      connected = name;
    },
  );
  assert.equal(serverStarted, false);
  assert.equal(connected, 'pmm-server-discovered');
  assert.equal(provisionerServer, 'pmm-server-discovered');
});

test('orchestrate propagates the discovery error and never starts a server with --reuse-server', async () => {
  let serverStarted = false;
  let connectCalled = false;
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverStarted = true;
    return { code: 0, stdout: '', stderr: '' };
  };
  await assert.rejects(
    () =>
      orchestrate(
        parseConfig(['--db', 'ps', '--reuse-server']),
        runner,
        async () => 'client.tar.gz',
        async () => {
          throw new Error('no PMM server found; pass --pmm-server');
        },
        async () => {
          connectCalled = true;
        },
      ),
    /no PMM server found; pass --pmm-server or omit --reuse-server/,
  );
  assert.equal(serverStarted, false);
  assert.equal(connectCalled, false);
});

test('resolves the client while PMM Server is still starting', async () => {
  let serverStarted = false;
  let resolvedBeforeServer = false;
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverStarted = true;
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(parseConfig(['--db', 'ps']), runner, async () => {
    resolvedBeforeServer = !serverStarted;
    return 'client.tar.gz';
  });
  assert.equal(resolvedBeforeServer, true);
});

test('formatStepSummary keeps only the slow steps, worst first', () => {
  const summary = formatStepSummary([
    { name: 'Check Docker', seconds: 0.2 },
    { name: 'Provision PS 8.0', seconds: 91.4 },
    { name: 'Start PMM Server and wait until ready', seconds: 128.7 },
  ]);
  assert.deepEqual(summary.split('\n').slice(2), [
    '   128.7s  Start PMM Server and wait until ready',
    '    91.4s  Provision PS 8.0',
  ]);
  assert.equal(formatStepSummary([{ name: 'Check Docker', seconds: 0.2 }]), '');
});

test('childStepTimings lifts engine step timings out of buffered output', () => {
  const timings = childStepTimings(
    'PS 8.0',
    ['==> Start database nodes', '<== Start database nodes (42.5s)', '<!! Run workload failed (3s)'].join('\n'),
  );
  assert.deepEqual(timings, [
    { name: 'PS 8.0 · Start database nodes', seconds: 42.5 },
    { name: 'PS 8.0 · Run workload failed', seconds: 3 },
  ]);
});

test('provisions haproxy after its database backends', async () => {
  const order: string[] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === process.execPath) {
      const type = args[args.indexOf('--type') + 1];
      order.push(type === 'haproxy' ? 'haproxy' : args[0].includes('pxc') ? 'pxc' : 'ps');
    }
    return { code: 0, stdout: '', stderr: '' };
  };

  await orchestrate(
    parseConfig(['--db', 'haproxy', '--db', 'ps=8.0', '--db', 'pxc=8.0']),
    runner,
    async () => 'client.tar.gz',
  );

  assert.deepEqual(order, ['ps', 'pxc', 'haproxy']);
});

test('server-only orchestration skips client resolution and database provisioners', async () => {
  let serverStarted = false;
  let clientResolved = false;
  let provisioners = 0;
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverStarted = true;
    if (file === process.execPath) provisioners += 1;
    return { code: 0, stdout: '', stderr: '' };
  };

  await orchestrate(parseConfig([]), runner, async () => {
    clientResolved = true;
    return 'client.tar.gz';
  });

  assert.equal(serverStarted, true);
  assert.equal(clientResolved, false);
  assert.equal(provisioners, 0);
});

test('uses an existing PMM Server without recreating it', async () => {
  let serverRuns = 0;
  let provisionerServer = '';
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverRuns += 1;
    if (file === process.execPath) provisionerServer = args[args.indexOf('--pmm-server') + 1];
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(
    parseConfig(['--pmm-server', '192.0.2.10', '--db', 'ps']),
    runner,
    async () => 'client.tar.gz',
  );
  assert.equal(serverRuns, 0);
  assert.equal(provisionerServer, '192.0.2.10');
});

test('orchestrates a standalone client with an explicit tarball', async () => {
  const url = 'https://example.test/pmm-client.tar.gz';
  let childArgs: string[] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === process.execPath) childArgs = args;
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(
    parseConfig([
      '--db', 'client',
      '--pmm-server', 'pmm.example.test',
      '--client-version', url,
      '--admin-password', 'secret',
      '--metrics-mode', 'no',
    ]),
    runner,
    async (source) => {
      assert.equal(source, url);
      return 'client.tar.gz';
    },
  );
  assert.ok(childArgs[0].endsWith(provisioningPath('images', 'engines', 'services', 'setup.ts')));
  assert.ok(childArgs.includes('client'));
  assert.deepEqual(
    childArgs.slice(childArgs.indexOf('--client-tarball'), childArgs.indexOf('--client-tarball') + 2),
    ['--client-tarball', 'client.tar.gz'],
  );
  assert.equal(childArgs.includes('--version'), false);
});

test('bucket-only provisioning skips PMM Server and client resolution', async () => {
  let serverRuns = 0;
  let clientResolved = false;
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    if (file === 'docker' && args[0] === 'run') serverRuns += 1;
    return { code: 0, stdout: '', stderr: '' };
  };
  await orchestrate(parseConfig(['--db', 'bucket']), runner, async () => {
    clientResolved = true;
    return 'client.tar.gz';
  });
  assert.equal(serverRuns, 0);
  assert.equal(clientResolved, false);
});

test('parses --teardown', () => {
  assert.equal(parseConfig(['--teardown']).teardown, true);
  assert.equal(parseConfig([]).teardown, false);
});

test('teardownContainerIds collects server and provisioned containers', async () => {
  const filteredLabels: string[] = [];
  const runner: Runner = async (_file, args): Promise<CommandResult> => {
    const label = args[args.indexOf('--filter') + 1];
    filteredLabels.push(label);
    return label === 'label=pmm-qa.engine'
      ? { code: 0, stdout: 'container-a\ncontainer-b', stderr: '' }
      : { code: 0, stdout: '', stderr: '' };
  };
  const ids = await teardownContainerIds(runner);
  assert.deepEqual(ids, ['container-a', 'container-b']);
  assert.ok(filteredLabels.includes('label=pmm-qa.orchestrator=server'));
  assert.ok(filteredLabels.includes('label=pmm-qa.engine'));
});

test('teardownVolumeNames collects every provisioned volume family', async () => {
  const runner: Runner = async (_file, args): Promise<CommandResult> => {
    const filterValue = args[args.indexOf('--filter') + 1];
    if (filterValue === 'name=psmdb-') return { code: 0, stdout: 'psmdb-minio-backups', stderr: '' };
    if (filterValue === 'name=mysql-ps-minio-backups') return { code: 0, stdout: 'mysql-ps-minio-backups', stderr: '' };
    return { code: 0, stdout: 'pmm-data', stderr: '' };
  };
  const names = await teardownVolumeNames(runner);
  assert.deepEqual(new Set(names), new Set(['pmm-data', 'psmdb-minio-backups', 'mysql-ps-minio-backups']));
});

test('teardown removes matched containers, volumes, and the network', async () => {
  const calls: string[][] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    calls.push([file, ...args]);
    if (args[0] === 'ps') {
      return args[args.indexOf('--filter') + 1] === 'label=pmm-qa.engine'
        ? { code: 0, stdout: 'ps-container-1', stderr: '' }
        : { code: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'volume' && args[1] === 'ls') {
      return args[args.indexOf('--filter') + 1] === 'name=pmm-data'
        ? { code: 0, stdout: 'pmm-data', stderr: '' }
        : { code: 0, stdout: '', stderr: '' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  await teardown(runner);
  assert.ok(calls.some((call) => call.join(' ') === 'docker rm -fv ps-container-1'));
  assert.ok(calls.some((call) => call.join(' ') === 'docker volume rm -f pmm-data'));
  assert.ok(calls.some((call) => call.join(' ') === 'docker network rm pmm-qa'));
});

test('collects sanitized diagnostics for provisioned containers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pmm-diagnostics-'));
  const config = parseConfig([
    '--db', 'ps,root-password=hunter2', '--admin-password', 'top-secret',
  ]);
  const runner: Runner = async (_file, args): Promise<CommandResult> => {
    if (args[0] === 'ps' && args.includes('label=pmm-qa.engine')) {
      return { code: 0, stdout: 'abc123\tps-node\tpmm-qa/ps:8.0\tUp 1 minute', stderr: '' };
    }
    if (args[0] === 'ps') {
      return { code: 0, stdout: 'def456\tpmm-server\tperconalab/pmm-server:3-dev-latest\tUp 1 minute', stderr: '' };
    }
    if (args.includes('tail -n 200 /srv/logs/*.log')) {
      return { code: 0, stdout: 'pmm-managed: Internal server error for admin/top-secret', stderr: '' };
    }
    if (args[0] === 'logs') {
      return {
        code: 0,
        stdout: 'server-password=top-secret mysql -phunter2 mongodb://user:mongo-secret@host https://example.test/file?token=abc Bearer xyz',
        stderr: '',
      };
    }
    return { code: 0, stdout: 'PMM Server status: Connected\nmysqld_exporter Running', stderr: '' };
  };
  try {
    assert.equal(await collectDiagnostics(config, new Error('provision failed'), runner, directory), directory);
    const summary = await readFile(join(directory, 'summary.json'), 'utf8');
    const logs = await readFile(join(directory, 'ps-node.log'), 'utf8');
    const pmm = await readFile(join(directory, 'ps-node-pmm.txt'), 'utf8');
    assert.ok(summary.includes('provision failed'));
    assert.ok(!summary.includes('top-secret'));
    assert.ok(!summary.includes('hunter2'));
    assert.ok(!logs.includes('top-secret'));
    assert.ok(!logs.includes('hunter2'));
    assert.ok(!logs.includes('mongo-secret'));
    assert.ok(!logs.includes('token=abc'));
    assert.ok(!logs.includes('Bearer xyz'));
    assert.ok(pmm.includes('Connected'));
    const serverLogs = await readFile(join(directory, 'pmm-server-srv-logs.txt'), 'utf8');
    assert.ok(serverLogs.includes('Internal server error'));
    assert.ok(!serverLogs.includes('top-secret'));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('echoes a buffered job\'s step lines live, split chunks and all', () => {
  const printed: string[] = [];
  const echo = importantLineEcho('PS 8.0', (line) => printed.push(line));
  echo('==> Start database nodes\n[ OK ] docker run (1.2s)\n[WAIT] docker exec (1.1s)\n');
  echo('<== Start database no');
  echo('des (23.3s)\n<!! Run workload failed (2.0s)\n');
  assert.deepEqual(printed, [
    '[PS 8.0] ==> Start database nodes',
    '[PS 8.0] <== Start database nodes (23.3s)',
    '[PS 8.0] <!! Run workload failed (2.0s)',
  ]);
  const silent: string[] = [];
  importantLineEcho(undefined, (line) => silent.push(line))('==> nothing\n');
  assert.deepEqual(silent, []);
});
