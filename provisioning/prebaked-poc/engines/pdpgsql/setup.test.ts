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

test('builds the latest three PDPGSQL major versions', () => {
  assert.ok(dockerBuildArgs('pdpgsql=16').includes('PDPGSQL_VERSION=16'));
  assert.ok(dockerBuildArgs('pdpgsql=17').includes('pmm-qa/pdpgsql:17-prebaked'));
  assert.ok(dockerBuildArgs('pdpgsql=18').includes('pmm-qa/pdpgsql:18-prebaked'));
  assert.throws(() => dockerBuildArgs('pdpgsql=15'), /version must be 16, 17, or 18/);
});

test('parses single-node defaults', () => {
  const config = parseConfig([], {});
  assert.equal(config.version, '18');
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
  assert.throws(() => parseConfig(['--version', '15'], {}), /version must be 16, 17, or 18/);
});

test('starts PostgreSQL 18 with pg_stat_monitor', () => {
  const config = parseConfig([], {});
  assert.equal(containerName(config, 1), 'pdpgsql_pmm_18_1');
  assert.ok(postgresRunArgs(config).includes('shared_preload_libraries=pg_stat_monitor'));
});

test('creates a streaming replica from the primary', () => {
  const config = parseConfig(['--setup-type', 'replication'], {});
  const args = replicaRunArgs(config);
  assert.equal(containerName(config, 2), 'pdpgsql_pmm_replication_18_2');
  assert.ok(args.some((arg) => arg.includes('pg_basebackup')));
  assert.ok(args.some((arg) => arg.includes('PGPASSWORD=replPasswd')));
  assert.ok(args.some((arg) => arg.includes('pdpgsql_pmm_replication_18_1')));
  assert.ok(args.includes('pmm-qa.pdpgsql.setup-type=replication'));
  assert.ok(replicaRunArgs(config, 4).includes('pdpgsql_pmm_replication_18_4'));
});

test('configures three Patroni nodes against etcd', () => {
  const config = parseConfig(['--setup-type', 'patroni'], {});
  const args = patroniRunArgs(config, 1);
  assert.ok(args.includes('PATRONI_ETCD3_HOST=pdpgsql-etcd:2379'));
  assert.ok(args.includes('PATRONI_SCOPE=pdpgsql-18'));
  assert.ok(args.includes('pmm-qa.pdpgsql.setup-type=patroni'));
  assert.ok(args.includes('PATRONI_REPLICATION_USERNAME=replicator'));
  assert.ok(args.some((arg) => arg.includes('exec patroni /tmp/patroni.yml')));

  const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /percona\/percona-distribution-postgresql:\$\{PDPGSQL_VERSION\}-ubi8/);
  assert.match(dockerfile, /etcd percona-patroni/);
});

test('configures TLS for Patroni', () => {
  const config = parseConfig(['--setup-type', 'patroni', '--tls'], {});
  assert.ok(patroniRunArgs(config, 1).some((arg) => arg.includes('ssl_cert_file')));
});

test('registers TCP and local socket services', () => {
  const registrations = postgresqlRegistrationArgs(parseConfig([], {}), 'pdpgsql_pmm_18_1', '12345');
  assert.equal(registrations.length, 2);
  assert.ok(registrations[0].includes('127.0.0.1:5432'));
  assert.ok(registrations[1].includes('--socket=/tmp'));
});
