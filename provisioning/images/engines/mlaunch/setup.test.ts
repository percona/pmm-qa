import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { containerName, mlaunchInitCommand, parseConfig } from './setup.ts';

test('defaults to a psmdb 8.0 pss topology', () => {
  const config = parseConfig([], {});
  assert.equal(config.engine, 'psmdb');
  assert.equal(config.version, '8.0');
  assert.equal(config.setupType, 'pss');
  assert.equal(config.image, 'pmm-qa/mlaunch-psmdb:8.0');
  assert.equal(config.tls, false);
});

test('rejects an unsupported setup-type and tls on mongodb', () => {
  assert.throws(() => parseConfig(['--setup-type', 'sharding'], {}), /single or pss/);
  assert.throws(() => parseConfig(['--engine', 'mongodb', '--tls'], {}), /tls is supported on psmdb only/);
});

test('reads framework-compatible environment variables', () => {
  const config = parseConfig([], {
    MLAUNCH_ENGINE: 'mongodb',
    MLAUNCH_VERSION: '7.0',
    MLAUNCH_SETUP_TYPE: 'single',
    PMM_SERVER_CONTAINER_ADDRESS: 'pmm-server:8443',
    ADMIN_PASSWORD: 'secret',
  });
  assert.equal(config.engine, 'mongodb');
  assert.equal(config.version, '7.0');
  assert.equal(config.setupType, 'single');
  assert.equal(config.pmmServer, 'pmm-server:8443');
  assert.equal(config.adminPassword, 'secret');
});

test('containerName encodes engine, setup-type, and version distinctly', () => {
  assert.equal(containerName('psmdb', '8.0', 'pss'), 'mlaunch_psmdb_pss_8_0');
  assert.equal(containerName('psmdb', '8.0', 'single'), 'mlaunch_psmdb_8_0');
  assert.equal(containerName('mongodb', '8.0', 'pss'), 'mlaunch_mongodb_pss_8_0');
  const names = new Set([
    containerName('psmdb', '8.0', 'pss'),
    containerName('psmdb', '8.0', 'single'),
    containerName('mongodb', '8.0', 'pss'),
    containerName('mongodb', '8.0', 'single'),
  ]);
  assert.equal(names.size, 4);
});

test('mlaunchInitCommand builds a single mongod or a 3-node replica set', () => {
  const single = mlaunchInitCommand({ setupType: 'single', tls: false });
  assert.ok(single.includes('--single'));
  assert.ok(!single.includes('--replicaset'));

  const pss = mlaunchInitCommand({ setupType: 'pss', tls: false });
  assert.ok(pss.includes('--replicaset'));
  assert.ok(pss.includes('--nodes 3'));
});

test('mlaunchInitCommand appends TLS flags reusing the psmdb cert paths', () => {
  const tls = mlaunchInitCommand({ setupType: 'pss', tls: true });
  assert.ok(tls.includes('/etc/mongodb.pem'));
  assert.ok(tls.includes('/etc/mongodb-ca.crt'));
  const noTls = mlaunchInitCommand({ setupType: 'pss', tls: false });
  assert.ok(!noTls.includes('/etc/mongodb.pem'));
});

test('builds psmdb and mongodb mlaunch images', () => {
  const psmdb = dockerBuildArgs('mlaunch-psmdb=8.0');
  assert.ok(psmdb.includes('pmm-qa/mlaunch-psmdb:8.0'));
  assert.ok(psmdb.includes('MLAUNCH_ENGINE=psmdb'));

  const mongodb = dockerBuildArgs('mlaunch-mongodb=7.0');
  assert.ok(mongodb.includes('pmm-qa/mlaunch-mongodb:7.0'));
  assert.ok(mongodb.includes('MLAUNCH_ENGINE=mongodb'));

  assert.throws(() => dockerBuildArgs('mlaunch-psmdb=5.0'), /version must be 6.0, 7.0, or 8.0/);
});
