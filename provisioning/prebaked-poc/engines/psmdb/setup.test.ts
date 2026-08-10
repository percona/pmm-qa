import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import {
  mongodArguments,
  configuredTopology,
  parseConfig,
  topology,
  type Config,
  type MongoNode,
} from './setup.ts';

test('builds the latest three PSMDB major images', () => {
  assert.ok(dockerBuildArgs('psmdb=6.0').includes('pmm-qa/psmdb:6.0-prebaked'));
  assert.ok(dockerBuildArgs('psmdb=7.0').includes('pmm-qa/psmdb:7.0-prebaked'));
  assert.ok(dockerBuildArgs('psmdb=8.0').includes('PSMDB_VERSION=8.0'));
});

test('rejects unsupported PSMDB versions', () => {
  assert.throws(() => dockerBuildArgs('psmdb=5.0'), /version must be 6.0, 7.0, or 8.0/);
  assert.equal(parseConfig(['--version', 'latest'], {}).version, '8.0');
});

test('builds Oracle Linux variants', () => {
  const args = dockerBuildArgs('psmdb=8.0,ol-version=8');
  assert.ok(args.includes('OL_VERSION=8'));
  assert.ok(args.includes('pmm-qa/psmdb:8.0-ol8-prebaked'));
  assert.equal(parseConfig([], { OL_VERSION: '8' }).image, 'pmm-qa/psmdb:8.0-ol8-prebaked');
});

test('uses PSMDB 8 wiredTiger PSS defaults', () => {
  const config = parseConfig([], {});
  assert.equal(config.version, '8.0');
  assert.equal(config.setupType, 'pss');
  assert.equal(config.storageEngine, 'wiredTiger');
  assert.equal(config.image, 'pmm-qa/psmdb:8.0-prebaked');
  assert.equal(config.clientVersion, '3-dev-latest');
});

test('reads framework-compatible environment variables', () => {
  const config = parseConfig([], {
    PSMDB_VERSION: '7.0',
    MONGO_SETUP_TYPE: 'psa',
    MONGO_STORAGE_ENGINE: 'inMemory',
    PMM_CLIENT_VERSION: 'pmm3-rc',
    PMM_SERVER_CONTAINER_ADDRESS: 'pmm-server:8443',
    ADMIN_PASSWORD: 'secret',
    CLIENT_DEBUG: 'true',
  });
  assert.equal(config.version, '7.0');
  assert.equal(config.setupType, 'psa');
  assert.equal(config.storageEngine, 'inMemory');
  assert.equal(config.clientVersion, 'pmm3-rc');
  assert.equal(config.pmmServer, 'pmm-server:8443');
  assert.equal(config.adminPassword, 'secret');
  assert.equal(config.clientDebug, true);
});

test('normalizes shards and storage-engine spelling', () => {
  const config = parseConfig(
    ['--setup-type', 'shards', '--storage-engine', 'wiredtiger'],
    {},
  );
  assert.equal(config.setupType, 'sharding');
  assert.equal(config.storageEngine, 'wiredTiger');
});

test('rejects invalid storage and compose modes', () => {
  assert.throws(
    () => parseConfig(['--setup-type', 'sharding', '--storage-engine', 'inMemory'], {}),
    /only supported with pss or psa/,
  );
  assert.equal(parseConfig([], { GSSAPI: 'true' }).gssapi, true);
  const extra = parseConfig([], { COMPOSE_PROFILES: 'extra' });
  assert.equal(extra.replicaSets, 2);
  assert.deepEqual(configuredTopology(extra).map(({ name }) => name), [
    'rs101', 'rs102', 'rs103', 'rs201', 'rs202', 'rs203',
  ]);
});

test('supports framework PMM client tarball selectors', () => {
  assert.equal(
    parseConfig([], { PMM_CLIENT_VERSION: 'latest-tarball' }).clientTarball,
    'latest',
  );
  const url = 'https://example.test/pmm-client.tar.gz';
  const config = parseConfig(['--client-version', url], {});
  assert.equal(config.clientVersion, undefined);
  assert.equal(config.clientTarball, url);
});

test('creates fixed PSS and PSA inventories', () => {
  assert.deepEqual(
    topology('pss').map(({ name, role, replicationSet }) => ({
      name,
      role,
      replicationSet,
    })),
    [
      { name: 'rs101', role: 'data', replicationSet: 'rs' },
      { name: 'rs102', role: 'data', replicationSet: 'rs' },
      { name: 'rs103', role: 'data', replicationSet: 'rs' },
    ],
  );
  assert.equal(topology('psa')[2].role, 'arbiter');
  assert.equal(topology('psa')[0].name, 'psa_rs101');
});

test('creates two shards, config servers, and mongos', () => {
  const nodes = topology('sharding');
  assert.equal(nodes.length, 10);
  assert.equal(nodes.filter((node) => node.replicationSet === 'rs1').length, 3);
  assert.equal(nodes.filter((node) => node.replicationSet === 'rs2').length, 3);
  assert.equal(nodes.filter((node) => node.role === 'config').length, 3);
  assert.equal(nodes.filter((node) => node.role === 'mongos').length, 1);
  assert.equal(nodes.find((node) => node.role === 'mongos')?.name, 'sharding_mongos');
});

test('generates direct-process arguments for storage and sharding roles', () => {
  const config = parseConfig(
    ['--setup-type', 'psa', '--storage-engine', 'inMemory'],
    {},
  );
  assert.ok(mongodArguments(config, topology('psa')[0]).includes('--storageEngine=inMemory'));

  const sharded = parseConfig(['--setup-type', 'sharding'], {});
  const nodes = topology('sharding');
  assert.ok(
    mongodArguments(
      sharded,
      nodes.find((node) => node.role === 'config') as MongoNode,
    ).includes('--configsvr'),
  );
  assert.ok(
    mongodArguments(
      sharded,
      nodes.find((node) => node.replicationSet === 'rs1') as MongoNode,
    ).includes('--shardsvr'),
  );
  assert.equal(
    mongodArguments(sharded, nodes.find((node) => node.role === 'mongos') as MongoNode)[0],
    'mongos',
  );
});

test('builds and parses MongoDB Community', () => {
  assert.ok(dockerBuildArgs('mongodb=6.0').includes('pmm-qa/mongodb:6.0-prebaked'));
  const config = parseConfig(['--engine', 'mongodb', '--version', '8.0'], {});
  assert.equal(config.engine, 'mongodb');
  assert.equal(config.image, 'pmm-qa/mongodb:8.0-prebaked');
  assert.throws(() => parseConfig(['--engine', 'mongodb', '--storage-engine', 'inMemory'], {}), /wiredTiger only/);
});

test('enables optional TLS on MongoDB nodes', () => {
  const config = parseConfig(['--tls'], {});
  const mongodArgs = mongodArguments(config, topology('pss')[0]);
  assert.ok(mongodArgs.includes('--tlsMode=allowTLS'));
  assert.ok(
    mongodArgs.includes('--tlsAllowConnectionsWithoutCertificates'),
    'mongod must accept clientless TLS connections or pmm-admin --tls --tls-skip-verify cannot connect',
  );

  const sharded = parseConfig(['--tls', '--setup-type', 'sharding'], {});
  const mongosArgs = mongodArguments(
    sharded,
    topology('sharding').find((node) => node.role === 'mongos') as MongoNode,
  );
  assert.ok(mongosArgs.includes('--tlsMode=allowTLS'));
  assert.ok(mongosArgs.includes('--tlsAllowConnectionsWithoutCertificates'));
});
