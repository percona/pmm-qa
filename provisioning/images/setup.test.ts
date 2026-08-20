import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from './build.ts';
import {
  containerName,
  mysqlArguments,
  parseConfig,
  replicationCommands,
  topologyLabel,
} from './setup.ts';

test('builds the selected MySQL image', () => {
  const args57 = dockerBuildArgs('mysql=5.7');
  assert.ok(args57.includes('--target'));
  assert.ok(args57.includes('mysql-57'));
  assert.ok(args57.includes('pmm-qa/mysql:5.7'));
  assert.ok(args57.includes('engines/mysql/Dockerfile'));

  const args97 = dockerBuildArgs('mysql=9.7');
  assert.ok(args97.includes('mysql-epel'));
  assert.ok(args97.includes('MYSQL_IMAGE=mysql:9.7'));
  assert.throws(() => dockerBuildArgs('mysql=8.1'), /version must be/);
});

test('builds the selected PS image with its matching XtraBackup', () => {
  const args = dockerBuildArgs('ps=5.7');
  assert.ok(args.includes('PS_IMAGE=percona/percona-server:5.7'));
  assert.ok(args.includes('XTRABACKUP_PACKAGE=percona-xtrabackup-24'));
  assert.ok(args.includes('pmm-qa/ps:5.7'));
  assert.ok(args.includes('engines/ps/Dockerfile'));
  assert.throws(() => dockerBuildArgs('ps=8.1'), /version must be/);
});

test('accepts engine defaults and engine=version overrides', () => {
  assert.ok(dockerBuildArgs('ps=8.0').includes('pmm-qa/ps:8.0'));
  assert.ok(dockerBuildArgs('psmdb=8.0').includes('pmm-qa/psmdb:8.0'));
  assert.deepEqual(dockerBuildArgs('ps'), dockerBuildArgs('ps=8.0'));
  assert.deepEqual(dockerBuildArgs('psmdb'), dockerBuildArgs('psmdb=8.0'));
  assert.deepEqual(dockerBuildArgs('pdpgsql'), dockerBuildArgs('pdpgsql=18'));
  assert.throws(() => dockerBuildArgs('ps='), /<engine>\[=<version>\]/);
});

test('builds PSMDB and PDPGSQL from their engine directories', () => {
  const psmdb = dockerBuildArgs('psmdb=8.0');
  assert.ok(psmdb.includes('engines/psmdb/Dockerfile'));
  assert.ok(psmdb.includes('pmm-qa/psmdb:8.0'));

  const pdpgsql = dockerBuildArgs('pdpgsql=18');
  assert.ok(pdpgsql.includes('engines/pdpgsql/Dockerfile'));
  assert.ok(pdpgsql.includes('pmm-qa/pdpgsql:18'));
  assert.throws(() => dockerBuildArgs('pdpgsql=13'), /version must be 14, 15, 16, 17, or 18/);
});

test('builds PDPGSQL with a PGSM_BRANCH build arg', () => {
  const args = dockerBuildArgs('pdpgsql=18,pgsm-branch=some-branch');
  assert.ok(args.includes('--build-arg'));
  assert.ok(args.includes('PGSM_BRANCH=some-branch'));
  assert.throws(() => dockerBuildArgs('mysql=8.0,pgsm-branch=x'), /has no build options/);
});

test('parses MySQL single-node defaults', () => {
  const config = parseConfig(['--engine', 'mysql'], {});
  assert.equal(config.engine, 'mysql');
  assert.equal(config.version, '9.7');
  assert.equal(config.image, 'pmm-qa/mysql:9.7');
  assert.equal(config.setupType, 'single');
  assert.equal(config.nodes, 1);
  assert.equal(config.querySource, 'perfschema');
  assert.equal(config.clientVersion, undefined);
  assert.equal(config.clientTarball, 'latest');
});

test('parses PS single-node defaults', () => {
  const config = parseConfig(['--engine', 'ps'], {});
  assert.equal(config.engine, 'ps');
  assert.equal(config.version, '8.0');
  assert.equal(config.image, 'pmm-qa/ps:8.0');
});

test('infers engine from framework environment names', () => {
  assert.equal(parseConfig([], { MS_VERSION: '8.0' }).engine, 'mysql');
  assert.equal(parseConfig([], { PS_VERSION: '8.0' }).engine, 'ps');
});

test('selects the image and replication dialect by MySQL version', () => {
  const legacy = parseConfig(
    ['--engine', 'mysql', '--version', '5.7', '--setup-type', 'replication'],
    {},
  );
  assert.equal(legacy.image, 'pmm-qa/mysql:5.7');
  assert.ok(mysqlArguments(legacy, 1).includes('--log-slave-updates=ON'));
  assert.equal(replicationCommands('5.7').start, 'START SLAVE');
  assert.equal(replicationCommands('8.0').start, 'START REPLICA');
  assert.equal(replicationCommands('5.7').ioRunning, 'Slave_IO_Running: Yes');
  assert.equal(replicationCommands('8.0').sqlRunning, 'Replica_SQL_Running: Yes');
  assert.equal(parseConfig(['--engine', 'mysql', '--version', '9.7'], {}).image, 'pmm-qa/mysql:9.7');
  assert.throws(() => parseConfig(['--engine', 'mysql', '--version', '8.1'], {}), /version must be/);
});

test('selects the image and replication dialect by PS version', () => {
  const legacy = parseConfig(['--engine', 'ps', '--version', '5.7', '--setup-type', 'replication'], {});
  assert.equal(legacy.image, 'pmm-qa/ps:5.7');
  assert.throws(() => parseConfig(['--engine', 'ps', '--version', '8.1'], {}), /version must be/);
});

test('supports every framework PMM client selector', () => {
  assert.equal(parseConfig(['--client-version', 'pmm3-latest'], {}).clientVersion, 'pmm3-latest');
  assert.equal(parseConfig(['--client-version', '3.9.1'], {}).clientVersion, '3.9.1');
  assert.equal(parseConfig(['--client-tarball', './client.tar.gz'], {}).clientVersion, undefined);
});

test('supports the existing pmm3-rc client selector', () => {
  const config = parseConfig(['--client-version', 'pmm3-rc'], {});
  assert.equal(config.clientVersion, 'pmm3-rc');
  assert.equal(config.clientTarball, undefined);
});

test('treats a client-version URL as a tarball for framework compatibility', () => {
  const url = 'https://example.test/pmm-client-PR-4483-47e47a8.tar.gz';
  const config = parseConfig(['--client-version', url], {});
  assert.equal(config.clientVersion, undefined);
  assert.equal(config.clientTarball, url);
});

test('does not mix package and tarball client sources', () => {
  assert.throws(
    () =>
      parseConfig(
        ['--client-version', 'pmm3-rc', '--client-tarball', './client.tar.gz'],
        {},
      ),
    /either client version or client tarball/,
  );
});

test('reads existing MySQL framework environment names', () => {
  const config = parseConfig([], {
    MS_VERSION: '8.0',
    SETUP_TYPE: 'replication',
    NODES_COUNT: '2',
    QUERY_SOURCE: 'slowlog',
    CLIENT_TARBALL: './client.tar.gz',
    ENCRYPTED_CLIENT_CONFIG: '1',
  });
  assert.equal(config.engine, 'mysql');
  assert.equal(config.version, '8.0');
  assert.equal(config.setupType, 'replication');
  assert.equal(config.nodes, 2);
  assert.equal(config.querySource, 'slowlog');
  assert.equal(config.encryptedClientConfig, true);
});

test('reads existing PS framework environment names', () => {
  const config = parseConfig([], {
    PS_VERSION: '8.0',
    SETUP_TYPE: 'replication',
    NODES_COUNT: '2',
    QUERY_SOURCE: 'slowlog',
    CLIENT_TARBALL: './client.tar.gz',
    MY_ROCKS: 'true',
    BACKUP: 'yes',
    ENCRYPTED_CLIENT_CONFIG: '1',
  });
  assert.equal(config.engine, 'ps');
  assert.equal(config.version, '8.0');
  assert.equal(config.myRocks, true);
  assert.equal(config.backup, true);
  assert.equal(config.encryptedClientConfig, true);
});

test('rejects PS-only flags on MySQL', () => {
  assert.throws(() => parseConfig(['--engine', 'mysql', '--my-rocks'], {}), /only supported with --engine ps/);
});

test('rejects an undersized topology', () => {
  assert.throws(
    () => parseConfig(['--setup-type', 'gr', '--nodes', '2'], {}),
    /requires at least 3 nodes/,
  );
});

test('keeps the existing MySQL container naming convention', () => {
  assert.equal(
    containerName({ engine: 'mysql', setupType: 'single', version: '8.4' }, 1),
    'mysql_pmm_8_4_1',
  );
  assert.equal(
    containerName({ engine: 'mysql', setupType: 'gr', version: '8.4' }, 3),
    'mysql_pmm_gr_8_4_3',
  );
});

test('keeps the existing PS container naming convention', () => {
  assert.equal(
    containerName({ engine: 'ps', setupType: 'single', version: '8.4' }, 1),
    'ps_pmm_8_4_1',
  );
  assert.equal(
    containerName({ engine: 'ps', setupType: 'replication', version: '5.7' }, 2),
    'ps_pmm_replication_5_7_2',
  );
});

test('scopes PS resources by topology', () => {
  assert.equal(
    topologyLabel(parseConfig(['--engine', 'ps', '--setup-type', 'replication'], {})),
    'pmm-qa.ps.setup-type=replication',
  );
});

test('generates unique GR identity and a shared seed list for MySQL', () => {
  const config = parseConfig(['--engine', 'mysql', '--setup-type', 'gr', '--nodes', '3'], {});
  const first = mysqlArguments(config, 1);
  assert.ok(
    first.includes(
      '--loose-group-replication-group-seeds=mysql_pmm_gr_9_7_1:34061,mysql_pmm_gr_9_7_2:34061,mysql_pmm_gr_9_7_3:34061',
    ),
  );
});

test('generates unique GR identity and a shared seed list for PS', () => {
  const config = parseConfig(['--engine', 'ps', '--setup-type', 'gr', '--nodes', '3'], {});
  const first = mysqlArguments(config, 1);
  assert.ok(
    first.includes(
      '--loose-group-replication-group-seeds=ps_pmm_gr_8_0_1:34061,ps_pmm_gr_8_0_2:34061,ps_pmm_gr_8_0_3:34061',
    ),
  );
  assert.ok(first.includes('--userstat=1'));
});

test('uses the legacy GR options only for 5.7', () => {
  const config = parseConfig(['--engine', 'mysql', '--version', '5.7', '--setup-type', 'gr'], {});
  const args = mysqlArguments(config, 1);
  assert.ok(args.includes('--transaction-write-set-extraction=XXHASH64'));
  assert.ok(!args.includes('--loose-group-replication-recovery-get-public-key=ON'));
});
