import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  isPmmAgentConnected,
  isPmmAgentDisconnected,
  isTransientServerError,
  pmmClientBuild,
  pruneClientTarballCache,
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

// A conditional request carries If-Modified-Since; a plain one does not.
function countingFetcher(reply: (conditional: boolean) => Response) {
  const calls = { downloads: 0, revalidations: 0 };
  const fetcher = (async (_url: string, init?: RequestInit) => {
    const conditional = Boolean((init?.headers as Record<string, string> | undefined)?.['If-Modified-Since']);
    if (conditional) calls.revalidations += 1;
    else calls.downloads += 1;
    return reply(conditional);
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

test('revalidates a cached client tarball rather than re-downloading it', async () => {
  const url = `https://example.test/pmm-client-latest-${process.pid}.tar.gz`;
  const { calls, fetcher } = countingFetcher((conditional) =>
    conditional ? new Response(null, { status: 304 }) : new Response('tarball'));

  const first = await resolveClientTarball(url, fetcher);
  const second = await resolveClientTarball(url, fetcher);
  assert.equal(first, second);
  assert.equal(calls.downloads, 1);
  assert.equal(calls.revalidations, 1);
  assert.equal(await readFile(first, 'utf8'), 'tarball');
  await rm(first);
});

test('a moving latest tarball is replaced when the build cache has a newer one', async () => {
  const url = `https://example.test/pmm-client-moved-${process.pid}.tar.gz`;
  const { calls, fetcher } = countingFetcher(() => new Response('newer tarball'));

  const first = await resolveClientTarball(url, fetcher);
  const second = await resolveClientTarball(url, fetcher);
  assert.equal(first, second);
  // The second call revalidated, got 200, and took the new body without a separate download.
  assert.equal(calls.downloads, 1);
  assert.equal(calls.revalidations, 1);
  assert.equal(await readFile(second, 'utf8'), 'newer tarball');
  await rm(second);
});

test('an unreachable build cache falls back to the cached tarball', async () => {
  const url = `https://example.test/pmm-client-offline-${process.pid}.tar.gz`;
  let attempts = 0;
  const fetcher = (async (_url: string, init?: RequestInit) => {
    attempts += 1;
    if (init) throw new Error('getaddrinfo ENOTFOUND');
    return new Response('tarball');
  }) as unknown as typeof fetch;

  const first = await resolveClientTarball(url, fetcher);
  const second = await resolveClientTarball(url, fetcher);
  assert.equal(second, first);
  assert.equal(attempts, 2);
  assert.equal(await readFile(second, 'utf8'), 'tarball');
  await rm(second);
});

test('pruning drops abandoned tarballs and keeps recent and in-use ones', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pmm-cache-'));
  const entry = async (key: string, ageDays: number) => {
    const path = join(directory, `pmm-client-${key}.tar.gz`);
    await writeFile(path, 'tarball');
    const when = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    await utimes(path, when, when);
    return path;
  };
  const stale = await entry('a'.repeat(16), 30);
  const recent = await entry('b'.repeat(16), 3);
  const inUse = await entry('c'.repeat(16), 30);
  const unrelated = join(directory, 'notes.txt');
  await writeFile(unrelated, 'keep me');

  const removed = await pruneClientTarballCache(inUse, directory);
  assert.deepEqual(removed, [stale]);
  await assert.rejects(() => readFile(stale, 'utf8'));
  assert.equal(await readFile(recent, 'utf8'), 'tarball');
  assert.equal(await readFile(inUse, 'utf8'), 'tarball');
  assert.equal(await readFile(unrelated, 'utf8'), 'keep me');
  await rm(directory, { recursive: true });
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
