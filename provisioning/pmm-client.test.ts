import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  isPmmAgentConnected,
  isPmmAgentDisconnected,
  isTransientServerError,
  pmmClientBuild,
  resolveClientTarball,
  retry,
  setupPmmAgents,
  waitForPmmExporter,
  waitForPmmServerReady,
} from './pmm-client.ts';

test('selects the PMM client package build', () => {
  assert.equal(pmmClientBuild('3.6.0'), 7);
  assert.equal(pmmClientBuild('3.7.1'), 8);
  assert.equal(pmmClientBuild('3.9.0'), 1);
});

test('waits for the PMM agent connection instead of a running local process', () => {
  assert.equal(isPmmAgentConnected('pmm-agent: RUNNING'), false);
  assert.equal(isPmmAgentConnected('PMM Server status: Connected'), true);
});

test('retries only a disconnected PMM agent registration', () => {
  assert.equal(isPmmAgentDisconnected(new Error('pmm-agent is not connected to PMM Server')), true);
  assert.equal(isPmmAgentDisconnected(new Error('invalid PostgreSQL credentials')), false);
});

test('waits for PMM Server readiness at the engine, and fails fast on a dead container', async () => {
  const external = await waitForPmmServerReady('192.0.2.10:443', async () => ({ stdout: '', stderr: '' }));
  assert.equal(external, undefined);

  let readyzChecks = 0;
  await waitForPmmServerReady(
    'pmm-server',
    async (args) => {
      if (args[0] === 'inspect') return { stdout: 'true\n', stderr: '' };
      readyzChecks += 1;
      return { stdout: readyzChecks < 3 ? '' : '{}', stderr: '' };
    },
    async () => undefined,
  );
  assert.equal(readyzChecks, 3);

  await assert.rejects(
    () => waitForPmmServerReady(
      'pmm-server',
      async (args) => ({ stdout: args[0] === 'inspect' ? 'false\n' : '', stderr: '' }),
      async () => undefined,
    ),
    /is not running/,
  );
});

test('serializes PMM agent registrations', async () => {
  let active = 0;
  let peak = 0;
  const execute = async (args: string[]) => {
    if (args.includes('setup')) {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
    }
    return {
      stdout: args.includes('status') ? 'PMM Server status: Connected' : '',
      stderr: '',
    };
  };
  await setupPmmAgents({
    adminPassword: 'admin', metricsMode: 'auto', encryptedClientConfig: false,
    clientDebug: false,
  }, ['node-1', 'node-2', 'node-3'], 'pmm-server', execute);
  assert.equal(peak, 1);
});

test('retries agent setup on a cold server but not on a real misconfiguration', async () => {
  assert.equal(isTransientServerError(new Error('dial tcp 10.0.0.5:8443: connect: connection refused')), true);
  assert.equal(isTransientServerError(new Error('unexpected EOF')), true);
  assert.equal(isTransientServerError(new Error('server returned 503 Service Unavailable')), true);
  // Observed on a real 3-node run: concurrent first registrations make PMM Server answer 500.
  assert.equal(
    isTransientServerError(new Error('Failed to register pmm-agent on PMM Server: Internal server error..')),
    true,
  );
  assert.equal(isTransientServerError(new Error('invalid username or password')), false);

  const attempts: string[] = [];
  const execute = async (args: string[]) => {
    if (args.includes('setup')) {
      const name = args.at(-1)!;
      attempts.push(name);
      if (name === 'node-2' && attempts.filter((node) => node === 'node-2').length === 1) {
        throw new Error('dial tcp 172.18.0.2:8443: connect: connection refused');
      }
    }
    return { stdout: args.includes('status') ? 'PMM Server status: Connected' : '', stderr: '' };
  };
  await setupPmmAgents({
    adminPassword: 'admin', metricsMode: 'auto', encryptedClientConfig: false,
    clientDebug: false,
  }, ['node-1', 'node-2'], 'pmm-server', execute, async () => undefined);
  assert.deepEqual(attempts.filter((node) => node === 'node-2').length, 2);
});

test('lets every PMM agent job settle before reporting a failure', async () => {
  let thirdFinished = false;
  const execute = async (args: string[]) => {
    const name = args[args.indexOf('setup') === -1 ? 2 : args.length - 1];
    if (args.includes('setup') && name === 'node-2') throw new Error('node-2 failed');
    if (args.includes('setup') && name === 'node-3') {
      await new Promise((resolve) => setImmediate(resolve));
      thirdFinished = true;
    }
    return { stdout: args.includes('status') ? 'PMM Server status: Connected' : '', stderr: '' };
  };
  await assert.rejects(() => setupPmmAgents({
    adminPassword: 'admin', metricsMode: 'auto', encryptedClientConfig: false,
    clientDebug: false,
  }, ['node-1', 'node-2', 'node-3'], 'pmm-server', execute), /1 of 3 PMM agent setup/);
  assert.equal(thirdFinished, true);
});

test('waits for the exact PMM exporter', async () => {
  await waitForPmmExporter('node-1', 'mysqld_exporter', async () => ({
    stdout: 'PMM Server status: Connected\nmysqld_exporter Running', stderr: '',
  }));
});

test('uses an existing local client tarball', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pmm-client-'));
  const tarball = join(directory, 'pmm-client.tar.gz');
  await writeFile(tarball, 'test');
  assert.equal(await resolveClientTarball(tarball), tarball);
  await rm(directory, { recursive: true });
});

test('downloads a remote client tarball only once', async () => {
  let downloads = 0;
  const url = `https://example.test/pmm-client-${process.pid}.tar.gz`;
  const fetcher = (async () => {
    downloads += 1;
    return new Response('tarball');
  }) as typeof fetch;

  const first = await resolveClientTarball(url, fetcher);
  const second = await resolveClientTarball(url, fetcher);
  assert.equal(first, second);
  assert.equal(downloads, 1);
  await rm(first);
});

test('a timed-out retry reports what the last attempt actually returned', async () => {
  await assert.rejects(
    () => retry(
      'node-2 to accept MySQL connections',
      async () => ({ stdout: '', stderr: "mysqladmin: connect to server at '127.0.0.1' failed" }),
      (result) => result.stdout.includes('mysqld is alive'),
      () => true,
      2,
      async () => undefined,
    ),
    /timed out waiting for node-2 to accept MySQL connections; last output: mysqladmin: connect to server/,
  );
  await assert.rejects(
    () => retry('a thrown failure', async () => { throw new Error('daemon unreachable'); },
      () => true, () => true, 2, async () => undefined),
    /timed out waiting for a thrown failure; last output: daemon unreachable/,
  );
});
