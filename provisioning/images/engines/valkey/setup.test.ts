import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { clusterRunArgs, nodeNames, parseConfig, sentinelRunArgs, serviceArgs, workloadArgs } from './setup.ts';

test('builds supported Valkey versions', () => {
  assert.ok(dockerBuildArgs('valkey=7').includes('VALKEY_VERSION=7'));
  assert.ok(dockerBuildArgs('valkey=8').includes('pmm-qa/valkey:8'));
  assert.throws(() => dockerBuildArgs('valkey=6'), /version must be 7 or 8/);
});

test('parses cluster and sentinel topologies', () => {
  assert.equal(parseConfig([], {}).setupType, 'cluster');
  assert.equal(parseConfig(['--setup-type', 'sentinels'], {}).setupType, 'sentinel');
  assert.deepEqual(nodeNames('cluster'), ['valkey-primary-1', 'valkey-primary-2', 'valkey-primary-3', 'valkey-replica-4', 'valkey-replica-5', 'valkey-replica-6']);
  assert.equal(nodeNames('sentinel').length, 6);
});

test('starts cluster and sentinel commands', () => {
  const cluster = parseConfig([], {});
  assert.ok(clusterRunArgs(cluster, 'valkey-primary-1').some((arg) => arg.includes('--cluster-enabled yes')));
  const sentinel = parseConfig(['--setup-type', 'sentinel'], {});
  assert.ok(sentinelRunArgs(sentinel, 'valkey-sentinel-1').some((arg) => arg.includes('sentinel resolve-hostnames yes')));
});

test('workload exercises charted commands without hiding failures', () => {
  const args = workloadArgs(parseConfig([], {}), 'valkey-primary-1').join(' ');

  for (const command of ['SET k$i', 'GET k$i', 'HSET h$i', 'LPUSH l$i', 'RPUSH l$i', 'LRANGE l$i', 'LPOP l$i', 'RPOP l$i']) {
    assert.ok(args.includes(command), command);
  }

  assert.ok(args.includes('valkey-cli -c'), 'follows cluster redirects');
  assert.ok(!args.includes('|| true'));

  const replica = workloadArgs(parseConfig(['--setup-type', 'sentinel'], {}), 'valkey-replica-1').join(' ');
  assert.ok(replica.includes('GET k$i') && replica.includes('LRANGE l$i'));
  assert.ok(!replica.includes('SET k$i'));
});

test('registers topology-correct PMM labels and replication sets', () => {
  const cluster = parseConfig([], {});
  assert.ok(serviceArgs(cluster, 'valkey-primary-2').includes('--custom-labels=role=primary'));
  assert.ok(serviceArgs(cluster, 'valkey-primary-2').includes('--cluster=valkey-native-cluster'));

  const sentinel = parseConfig(['--setup-type', 'sentinel'], {});
  assert.ok(serviceArgs(sentinel, 'valkey-replica-1').includes('--replication-set=valkey-repl'));
  assert.ok(serviceArgs(sentinel, 'valkey-replica-1').includes('--custom-labels=role=replica'));
  assert.ok(serviceArgs(sentinel, 'valkey-sentinel-1').includes('--custom-labels=role=sentinel'));
  assert.ok(!serviceArgs(sentinel, 'valkey-sentinel-1').includes('--replication-set=valkey-repl'));
});
