import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import {
  containerName,
  nodeCount,
  parseConfig,
  patroniRunArgs,
  postgresqlRegistrationArgs,
  postgresRunArgs,
  replicaRunArgs,
} from './setup.ts';

test('builds every supported PDPGSQL major version', () => {
  assert.ok(dockerBuildArgs('pdpgsql=14').includes('PDPGSQL_VERSION=14'));
  assert.ok(dockerBuildArgs('pdpgsql=15').includes('pmm-qa/pdpgsql:15'));
  assert.ok(dockerBuildArgs('pdpgsql=16').includes('PDPGSQL_VERSION=16'));
  assert.ok(dockerBuildArgs('pdpgsql=17').includes('pmm-qa/pdpgsql:17'));
  assert.ok(dockerBuildArgs('pdpgsql=18').includes('pmm-qa/pdpgsql:18'));
  assert.throws(() => dockerBuildArgs('pdpgsql=13'), /version must be 14, 15, 16, 17, or 18/);
});

test('parses single-node defaults', () => {
  const config = parseConfig([], {});
  assert.equal(config.version, '17');
  assert.equal(config.setupType, 'single');
  assert.equal(config.nodes, 1);
  assert.equal(config.clientTarball, 'latest');
  assert.equal(nodeCount(config.setupType), 1);
});

test('accepts replication and Patroni setup types', () => {
  assert.equal(parseConfig(['--setup-type', 'replication'], {}).setupType, 'replication');
  assert.equal(parseConfig([], { SETUP_TYPE: 'patroni' }).setupType, 'patroni');
  assert.equal(nodeCount('replication'), 2);
  assert.equal(nodeCount('patroni'), 3);
  assert.equal(nodeCount('replication', '4'), 4);
  assert.equal(parseConfig(['--setup-type', 'patroni', '--nodes', '5'], {}).nodes, 5);
  assert.throws(() => parseConfig(['--setup-type', 'replication', '--nodes', '1'], {}), /at least 2/);
  assert.throws(() => parseConfig(['--nodes', '2'], {}), /exactly 1/);
  assert.throws(() => parseConfig(['--setup-type', 'cluster'], {}), /setup type/);
  assert.equal(parseConfig(['--version', '17'], {}).version, '17');
  assert.equal(parseConfig(['--version', '14'], {}).version, '14');
  assert.throws(() => parseConfig(['--version', '13'], {}), /version must be 14, 15, 16, 17, or 18/);
});

test('starts PostgreSQL with pg_stat_monitor', () => {
  const config = parseConfig([], {});
  assert.equal(containerName(config, 1), 'pdpgsql_pmm_17_1');
  assert.ok(postgresRunArgs(config).includes('shared_preload_libraries=pg_stat_monitor'));
});

test('waits for initialization to finish before accepting PostgreSQL readiness', () => {
  const source = readFileSync(new URL('./setup.ts', import.meta.url), 'utf8');
  assert.match(source, /PostgreSQL init process complete[\s\S]+await waitForPostgres/);
});

test('creates a streaming replica from the primary', () => {
  const config = parseConfig(['--setup-type', 'replication'], {});
  const args = replicaRunArgs(config);
  assert.ok(postgresRunArgs(config).includes('wal_keep_size=512MB'));
  assert.equal(containerName(config, 2), 'pdpgsql_pmm_replication_17_2');
  assert.ok(args.some((arg) => arg.includes('pg_basebackup')));
  assert.ok(args.some((arg) => arg.includes('PGPASSWORD=replPasswd')));
  assert.ok(args.some((arg) => arg.includes('pdpgsql_pmm_replication_17_1')));
  assert.ok(args.includes('pmm-qa.pdpgsql.setup-type=replication'));
  assert.ok(replicaRunArgs(config, 4).includes('pdpgsql_pmm_replication_17_4'));
});

test('configures three Patroni nodes against etcd', () => {
  const config = parseConfig(['--setup-type', 'patroni'], {});
  const args = patroniRunArgs(config, 1);
  assert.ok(args.includes('PATRONI_ETCD3_HOST=pdpgsql-etcd:2379'));
  assert.ok(args.includes('PATRONI_SCOPE=pdpgsql-17'));
  assert.ok(args.includes('pmm-qa.pdpgsql.setup-type=patroni'));
  assert.ok(args.includes('PATRONI_REPLICATION_USERNAME=replicator'));
  assert.ok(args.some((arg) => arg.includes('exec patroni /tmp/patroni.yml')));

  const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /percona\/percona-distribution-postgresql:\$\{PDPGSQL_VERSION\}-ubi8/);
  assert.match(dockerfile, /etcd percona-patroni/);
});

test('configures TLS for Patroni', () => {
  const config = parseConfig(['--setup-type', 'patroni', '--tls'], {});
  const command = patroniRunArgs(config, 1).at(-1)!;
  assert.ok(command.includes('ssl_cert_file'));
  assert.ok(command.includes('-keyout /tmp/patroni-server.key'));
  assert.ok(!command.includes('/var/lib/postgresql/data/server.key'));
});

test('restarts a TLS-enabled PostgreSQL container through Docker', () => {
  const source = readFileSync(new URL('./setup.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /pg_ctl restart/);
  assert.match(source, /await docker\(\['restart', name\]\);\s+await waitForPostgres\(name\);/);
});

test('starts more than two replicas sequentially', () => {
  const source = readFileSync(new URL('./setup.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(config\.nodes > 3\)/);
  assert.match(source, /await Promise\.all\(replicas\.map\(startReplica\)\)/);
});

test('registers TCP and local socket services', () => {
  const registrations = postgresqlRegistrationArgs(parseConfig([], {}), 'pdpgsql_pmm_17_1', '12345');
  assert.equal(registrations.length, 2);
  assert.ok(registrations[0].includes('127.0.0.1:5432'));
  assert.ok(registrations[1].includes('--socket=/tmp'));
});
