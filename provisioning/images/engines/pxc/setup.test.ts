import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dockerBuildArgs, proxyBuildArgs } from '../../build.ts';
import { containerName, databaseUsersSql, parseConfig, proxyRunArgs, pxcRunArgs, upstreamProxySql } from './setup.ts';

test('builds supported PXC images', () => {
  assert.ok(dockerBuildArgs('pxc=5.7').includes('PXC_IMAGE=percona/percona-xtradb-cluster:5.7'));
  assert.ok(dockerBuildArgs('pxc=8.0').includes('pmm-qa/pxc:8.0'));
  assert.ok(dockerBuildArgs('pxc=8.4').includes('PXC_IMAGE=percona/percona-xtradb-cluster:8.4'));
  assert.ok(dockerBuildArgs('pxc=9.7').includes('pmm-qa/pxc:9.7'));
  assert.throws(() => dockerBuildArgs('pxc=10.0'), /version must be/);
});

test('builds the Percona ProxySQL image', () => {
  assert.ok(proxyBuildArgs('8.0').includes('pmm-qa/proxysql:2'));
  const upstream = proxyBuildArgs('8.4');
  assert.ok(upstream.includes('engines/pxc/proxy/Dockerfile.upstream'));
  assert.ok(upstream.includes('pmm-qa/proxysql:3'));
});

test('parses framework-compatible defaults', () => {
  const config = parseConfig([], {});
  assert.equal(config.version, '8.0');
  assert.equal(config.nodes, 3);
  assert.equal(config.cluster, 'pxc-dev-cluster');
  assert.equal(config.querySource, 'perfschema');
  assert.equal(config.clientTarball, 'latest');
});

test('reads existing PXC environment names', () => {
  const config = parseConfig([], {
    PXC_VERSION: '5.7',
    PXC_NODES: '5',
    PXC_CLUSTER_NAME: 'test-cluster',
    QUERY_SOURCE: 'slowlog',
    CLIENT_VERSION: 'pmm3-rc',
  });
  assert.equal(config.version, '5.7');
  assert.equal(config.nodes, 5);
  assert.equal(config.cluster, 'test-cluster');
  assert.equal(config.querySource, 'slowlog');
  assert.equal(config.clientVersion, 'pmm3-rc');
});

test('rejects invalid topology and query source', () => {
  assert.throws(() => parseConfig(['--nodes', '2'], {}), /at least 3/);
  assert.throws(() => parseConfig(['--query-source', 'none'], {}), /query source/);
});

test('joins later nodes to the first node', () => {
  const config = parseConfig([], {});
  assert.equal(containerName(1), 'pxc_pmm_1');
  assert.ok(!pxcRunArgs(config, 1).some((arg) => arg.startsWith('CLUSTER_JOIN=')));
  assert.ok(pxcRunArgs(config, 2).includes('CLUSTER_JOIN=pxc_pmm_1'));
  assert.ok(pxcRunArgs(config, 2).includes('--pxc-encrypt-cluster-traffic=OFF'));
});

test('uses Galera readiness checks without a fixed bootstrap delay', () => {
  const source = readFileSync(new URL('./setup.ts', import.meta.url), 'utf8');
  assert.match(source, /MySQL init process done\. Ready for start up\.[\s\S]+wsrep_ready[\s\S]+wsrep_cluster_status[\s\S]+wsrep_local_state_comment/);
  assert.doesNotMatch(source, /\bsleep\s*\(/);
});

test('starts the Percona ProxySQL image', () => {
  const config = parseConfig([], {});
  assert.equal(config.proxyImage, 'pmm-qa/proxysql:2');
  assert.ok(proxyRunArgs(config).includes(config.proxyImage));
  assert.ok(!proxyRunArgs(config).some((arg) => arg.includes('proxysql.cnf')));
});

test('PXC 8.4 and 9.7 select and configure upstream ProxySQL 3', () => {
  for (const version of ['8.4', '9.7']) {
    assert.equal(parseConfig(['--version', version], {}).proxyImage, 'pmm-qa/proxysql:3');
    assert.match(databaseUsersSql(version as '8.4' | '9.7'), /caching_sha2_password/);
  }
  const sql = upstreamProxySql(3);
  assert.match(sql, /\(0,'pxc_pmm_3',3306\)/);
  assert.match(sql, /admin-stats_credentials/);
  assert.match(sql, /proxysql_user/);
});

test('keeps framework-compatible Galera hostgroups and credentials', () => {
  const adminConfig = readFileSync(new URL('./proxysql-admin.cnf', import.meta.url), 'utf8');
  for (const value of [
    "CLUSTER_HOSTNAME='pxc_pmm_1'",
    "CLUSTER_USERNAME='admin'",
    "MONITOR_USERNAME='monitor'",
    "CLUSTER_APP_USERNAME='proxysql_user'",
    "WRITER_HOSTGROUP_ID='10'",
    "READER_HOSTGROUP_ID='11'",
    "BACKUP_WRITER_HOSTGROUP_ID='12'",
    "OFFLINE_HOSTGROUP_ID='13'",
  ]) {
    assert.ok(adminConfig.includes(value), value);
  }

  const proxyImage = readFileSync(new URL('./proxy/Dockerfile', import.meta.url), 'utf8');
  assert.match(proxyImage, /dnf install -y proxysql2 mysql/);
});
