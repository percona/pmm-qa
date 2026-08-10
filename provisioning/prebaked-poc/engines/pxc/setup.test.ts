import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dockerBuildArgs, proxyBuildArgs } from '../../build.ts';
import { containerName, parseConfig, proxyRunArgs, pxcRunArgs } from './setup.ts';

test('builds supported PXC images', () => {
  assert.ok(dockerBuildArgs('pxc=5.7').includes('PXC_IMAGE=percona/percona-xtradb-cluster:5.7'));
  assert.ok(dockerBuildArgs('pxc=8.0').includes('pmm-qa/pxc:8.0-prebaked'));
  assert.throws(() => dockerBuildArgs('pxc=8.4'), /version must be/);
});

test('builds the Percona ProxySQL image', () => {
  const args = proxyBuildArgs();
  assert.ok(args.includes('engines/pxc/proxy/Dockerfile'));
  assert.ok(args.includes('pmm-qa/proxysql:2-prebaked'));
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

test('starts the prebaked Percona ProxySQL image', () => {
  const config = parseConfig([], {});
  assert.equal(config.proxyImage, 'pmm-qa/proxysql:2-prebaked');
  assert.ok(proxyRunArgs(config).includes(config.proxyImage));
  assert.ok(!proxyRunArgs(config).some((arg) => arg.includes('proxysql.cnf')));
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
