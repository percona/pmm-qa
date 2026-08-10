import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  isPmmAgentConnected,
  isPmmAgentDisconnected,
  pmmClientBuild,
  resolveClientTarball,
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
