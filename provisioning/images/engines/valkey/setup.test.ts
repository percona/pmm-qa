import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { clusterRunArgs, nodeNames, parseConfig, sentinelRunArgs } from './setup.ts';

test('builds supported Valkey versions', () => {
  assert.ok(dockerBuildArgs('valkey=7').includes('VALKEY_VERSION=7'));
  assert.ok(dockerBuildArgs('valkey=8').includes('pmm-qa/valkey:8'));
  assert.throws(() => dockerBuildArgs('valkey=6'), /version must be 7 or 8/);
});

test('parses cluster and sentinel topologies', () => {
  assert.equal(parseConfig([], {}).setupType, 'cluster');
  assert.equal(parseConfig(['--setup-type', 'sentinels'], {}).setupType, 'sentinel');
  assert.equal(nodeNames('cluster').length, 6);
  assert.equal(nodeNames('sentinel').length, 6);
});

test('starts cluster and sentinel commands', () => {
  const cluster = parseConfig([], {});
  assert.ok(clusterRunArgs(cluster, 'valkey-node-1').some((arg) => arg.includes('--cluster-enabled yes')));
  const sentinel = parseConfig(['--setup-type', 'sentinel'], {});
  assert.ok(sentinelRunArgs(sentinel, 'valkey-sentinel-1').some((arg) => arg.includes('sentinel resolve-hostnames yes')));
});
