import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { containerName, parseConfig, postgresRunArgs, replicaRunArgs } from './setup.ts';

test('builds every supported PostgreSQL version', () => {
  for (const version of ['14', '15', '16', '17', '18']) {
    assert.ok(dockerBuildArgs(`pgsql=${version}`).includes(`pmm-qa/pgsql:${version}`));
  }
  assert.throws(() => dockerBuildArgs('pgsql=13'), /version must be 14, 15, 16, 17, or 18/);
});

test('parses single and replication topologies', () => {
  const single = parseConfig([], {});
  assert.equal(single.version, '17');
  assert.equal(single.nodes, 1);
  assert.equal(containerName(single, 1), 'pgsql_pmm_17_1');
  const replication = parseConfig(['--version', '18', '--setup-type', 'replication', '--nodes', '3'], {});
  assert.equal(replication.nodes, 3);
  assert.equal(containerName(replication, 2), 'pgsql_pmm_replication_18_2');
  assert.throws(() => parseConfig(['--setup-type', 'replication', '--nodes', '1'], {}), /at least 2/);
});

test('starts PostgreSQL with pg_stat_statements', () => {
  assert.ok(postgresRunArgs(parseConfig([], {})).includes('shared_preload_libraries=pg_stat_statements'));
  // Retained WAL only matters once replicas clone from the primary.
  assert.ok(!postgresRunArgs(parseConfig([], {})).includes('wal_keep_size=512MB'));
  assert.ok(postgresRunArgs(parseConfig(['--setup-type', 'replication', '--nodes', '3'], {})).includes('wal_keep_size=512MB'));
  assert.ok(postgresRunArgs(parseConfig(['--tls'], {})).includes('ssl=on'));
});

test('replica bootstrap fixes PGDATA permissions before pg_basebackup', () => {
  const config = parseConfig(['--setup-type', 'replication', '--nodes', '2'], {});
  const args = replicaRunArgs(config, 'pgsql_pmm_replication_18_1', 2);
  const command = args.at(-1) ?? '';
  assert.match(command, /chmod 700 "\$PGDATA"/);
  assert.ok(command.indexOf('chmod 700 "$PGDATA"') < command.indexOf('pg_basebackup'));
});
