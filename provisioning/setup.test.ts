import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  backendTargets,
  databaseArchive,
  databaseImage,
  ensureDocker,
  orchestrate,
  parseConfig,
  parseDatabase,
  provisionerArgs,
  resolveClientArgs,
  startServer,
  teardown,
  teardownContainerIds,
  teardownVolumeNames,
  type CommandResult,
  type Runner,
} from './setup.ts';

test('parses server-only defaults without a database', () => {
  assert.deepEqual(parseConfig([]), {
    databases: [],
    serverImage: 'perconalab/pmm-server:3-dev-latest',
    pmmServer: undefined,
    adminPassword: 'admin',
    clientVersion: 'latest-tarball',
    metricsMode: 'auto',
    clientDebug: false,
    encryptedClientConfig: false,
    teardown: false,
    help: false,
  });
  assert.deepEqual(
    parseConfig([
      '--server-image',
      'perconalab/pmm-server-fb:PR-123-deadbeef',
      '--admin-password',
      'secret',
    ]),
    {
      databases: [],
      serverImage: 'perconalab/pmm-server-fb:PR-123-deadbeef',
      pmmServer: undefined,
      adminPassword: 'secret',
      clientVersion: 'latest-tarball',
      metricsMode: 'auto',
      clientDebug: false,
      encryptedClientConfig: false,
      teardown: false,
      help: false,
    },
  );
});

test('parses database defaults together', () => {
  const config = parseConfig([
    '--db', 'mysql', '--db', 'ps', '--db', 'pxc', '--db', 'psmdb', '--db', 'mongodb', '--db', 'pgsql', '--db', 'pdpgsql',
  ]);
  assert.deepEqual(
    config.databases.map(({ type, version, options }) => ({ type, version, options })),
    [
      {
        type: 'mysql',
        version: '8.4',
        options: { 'setup-type': 'single', 'query-source': 'perfschema' },
      },
      {
        type: 'ps',
        version: '8.4',
        options: { 'setup-type': 'single', 'query-source': 'perfschema' },
      },
      {
        type: 'pxc',
        version: '8.0',
        options: { 'setup-type': 'cluster', 'query-source': 'perfschema' },
      },
      {
        type: 'psmdb',
        version: '8.0',
        options: { 'setup-type': 'pss', 'storage-engine': 'wiredTiger' },
      },
      {
        type: 'mongodb',
        version: '8.0',
        options: { 'setup-type': 'pss', 'storage-engine': 'wiredTiger' },
      },
      {
        type: 'pgsql',
        version: '18',
        options: { 'setup-type': 'single' },
      },
      {
        type: 'pdpgsql',
        version: '18',
        options: { 'setup-type': 'single' },
      },
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
  assert.equal(parseDatabase('psmdb=8.0,compose-profiles=extra').options['replica-sets'], '2');

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

test('rejects duplicate, invalid, unknown, and cross-database options', () => {
  assert.throws(() => parseConfig(['--db', 'ps', '--db', 'ps=8.0']), /only once/);
  assert.throws(() => parseDatabase('ps=9.0'), /version must be/);
  assert.throws(() => parseDatabase('ps=8.4,unknown=yes'), /not supported/);
  assert.throws(() => parseDatabase('psmdb=8.0,query-source=slowlog'), /not supported/);
  assert.throws(() => parseDatabase('psmdb=8.0,ol-version=7'), /ol-version/);
  assert.throws(() => parseDatabase('psmdb=8.0,replica-sets=3'), /replica-sets/);
  assert.throws(() => parseDatabase('pxc=8.0,nodes=2'), /at least 3/);
  assert.equal(parseDatabase('pdpgsql=17').version, '17');
  assert.throws(() => parseDatabase('pdpgsql=18,setup-type=gr'), /PDPGSQL setup-type/);
  assert.throws(() => parseDatabase('pdpgsql=18,setup-type=replication,nodes=1'), /at least 2/);
  assert.throws(() => parseDatabase('pdpgsql=18,nodes=2'), /exactly 1/);
});

test('maps archives, images, and provisioner arguments', () => {
  const mysql = parseDatabase('mysql=9.7,setup-type=replication');
  assert.ok(provisionerArgs(mysql, [])[0].endsWith(resolve('provisioning', 'prebaked-poc', 'setup.ts')));
  assert.ok(provisionerArgs(mysql, []).includes('mysql'));

  const ps = parseDatabase('ps=8.4,setup-type=gr,query-source=slowlog,backup=true');
  assert.equal(databaseImage(ps), 'pmm-qa/ps:8.4-prebaked');
  assert.equal(databaseArchive(ps), resolve('provisioning', 'images', 'ps8.4.tar.gz'));
  const psArgs = provisionerArgs(ps, ['--client-tarball', 'C:\\cache\\client.tar.gz']);
  assert.ok(psArgs[0].endsWith(resolve('provisioning', 'prebaked-poc', 'setup.ts')));
  assert.ok(psArgs.includes('slowlog'));
  assert.ok(psArgs.includes('--backup'));

  const psmdb = parseDatabase('psmdb=8.0');
  assert.equal(databaseImage(psmdb), 'pmm-qa/psmdb:8.0-prebaked');
  assert.equal(databaseArchive(psmdb), resolve('provisioning', 'images', 'psmdb8.0.tar.gz'));
  assert.ok(
    provisionerArgs(psmdb, ['--client-version', '3.9.1'])[0].endsWith(
      resolve('provisioning', 'prebaked-poc', 'engines', 'psmdb', 'setup.ts'),
    ),
  );

  const pdpgsql = parseDatabase('pdpgsql=18,setup-type=replication,nodes=4');
  assert.equal(databaseImage(pdpgsql), 'pmm-qa/pdpgsql:18-prebaked');
  assert.equal(databaseArchive(pdpgsql), resolve('provisioning', 'images', 'pdpgsql18.tar.gz'));
  const pdpgsqlArgs = provisionerArgs(pdpgsql, ['--client-version', '3.9.1']);
  assert.ok(
    pdpgsqlArgs[0].endsWith(
      resolve('provisioning', 'prebaked-poc', 'engines', 'pdpgsql', 'setup.ts'),
    ),
  );
  assert.ok(pdpgsqlArgs.includes('replication'));
  assert.ok(pdpgsqlArgs.includes('4'));

  const pgsqlArgs = provisionerArgs(parseDatabase('pgsql=18,setup-type=replication'), []);
  assert.ok(pgsqlArgs[0].endsWith(resolve('provisioning', 'prebaked-poc', 'engines', 'pgsql', 'setup.ts')));

  const pxc = parseDatabase('pxc=8.0,nodes=3');
  const pxcArgs = provisionerArgs(pxc, [], 'admin', true, true);
  assert.ok(
    pxcArgs[0].endsWith(resolve('provisioning', 'prebaked-poc', 'engines', 'pxc', 'setup.ts')),
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

test('requires Docker to be running', async () => {
  const runner: Runner = async () => ({ code: 1, stdout: '', stderr: '' });
  await assert.rejects(() => ensureDocker(runner), /Docker is not running/);
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

  await startServer(
    { serverImage: 'perconalab/pmm-server:3-dev-latest', adminPassword: 'secret' },
    runner,
    async () => undefined,
  );

  assert.deepEqual(calls[0], ['docker', 'rm', '-f', 'pmm-server']);
  assert.ok(calls.some((call) => call.join(' ').includes('volume rm -f pmm-qa-pmm-server-data')));
  assert.ok(calls.some((call) => call.join(' ').includes('network create pmm-qa')));
  assert.ok(calls.some((call) => call.includes('GF_SECURITY_ADMIN_PASSWORD=secret')));
  assert.equal(readinessChecks, 2);
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
  assert.equal(databaseImage(ol8), 'pmm-qa/psmdb:8.0-ol8-prebaked');
  assert.equal(databaseArchive(ol8), resolve('provisioning', 'images', 'psmdb8.0-ol8.tar.gz'));
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
    return label === 'label=pmm-qa.poc'
      ? { code: 0, stdout: 'container-a\ncontainer-b', stderr: '' }
      : { code: 0, stdout: '', stderr: '' };
  };
  const ids = await teardownContainerIds(runner);
  assert.deepEqual(ids, ['container-a', 'container-b']);
  assert.ok(filteredLabels.includes('label=pmm-qa.orchestrator=server'));
  assert.ok(filteredLabels.includes('label=pmm-qa.poc'));
});

test('teardownVolumeNames collects volumes across every pmm-qa prefix', async () => {
  const runner: Runner = async (_file, args): Promise<CommandResult> => {
    const filterValue = args[args.indexOf('--filter') + 1];
    return filterValue === 'name=psmdb-poc-'
      ? { code: 0, stdout: 'psmdb-poc-minio-backups', stderr: '' }
      : { code: 0, stdout: 'pmm-qa-pmm-server-data', stderr: '' };
  };
  const names = await teardownVolumeNames(runner);
  assert.deepEqual(new Set(names), new Set(['pmm-qa-pmm-server-data', 'psmdb-poc-minio-backups']));
});

test('teardown removes matched containers, volumes, and the network', async () => {
  const calls: string[][] = [];
  const runner: Runner = async (file, args): Promise<CommandResult> => {
    calls.push([file, ...args]);
    if (args[0] === 'ps') {
      return args[args.indexOf('--filter') + 1] === 'label=pmm-qa.poc'
        ? { code: 0, stdout: 'ps-container-1', stderr: '' }
        : { code: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'volume' && args[1] === 'ls') {
      return args[args.indexOf('--filter') + 1] === 'name=pmm-qa-'
        ? { code: 0, stdout: 'pmm-qa-pmm-server-data', stderr: '' }
        : { code: 0, stdout: '', stderr: '' };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  await teardown(runner);
  assert.ok(calls.some((call) => call.join(' ') === 'docker rm -fv ps-container-1'));
  assert.ok(calls.some((call) => call.join(' ') === 'docker volume rm -f pmm-qa-pmm-server-data'));
  assert.ok(calls.some((call) => call.join(' ') === 'docker network rm pmm-qa'));
});
