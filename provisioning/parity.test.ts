import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { buildDescriptor, databaseImage, normalizeArgv, parseConfig, parseDatabase, provisionerArgs } from './setup.ts';

const WORKFLOWS = resolve(fileURLToPath(new URL('..', import.meta.url)), '.github', 'workflows');

// Every --database string the workflows actually pass. Read from disk rather than copied here, so a
// new CI setup string that provisioning/ cannot parse fails this test instead of a 20-minute job.
function workflowSpecs(): string[] {
  const specs = new Set<string>();
  for (const file of readdirSync(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = readFileSync(resolve(WORKFLOWS, file), 'utf8');
    for (const [, quoted] of text.matchAll(/^\s*(?:setup_services|services_list|default):\s*'([^']*--database[^']*)'/gm)) {
      specs.add(quoted);
    }
  }
  return [...specs];
}

test('accepts every --database string the workflows pass', async () => {
  const specs = workflowSpecs();
  assert.ok(specs.length > 20, `expected the workflow corpus, found ${specs.length} specs`);
  for (const spec of specs) {
    const config = parseConfig(spec.split(/\s+/).filter(Boolean), {});
    assert.ok(config.databases.length, `${spec} parsed to no databases`);
    // The same validation orchestrate() runs before it touches Docker.
    for (const database of config.databases) {
      const [script, ...args] = provisionerArgs(
        database, [], config.adminPassword, config.clientDebug,
        config.encryptedClientConfig, config.pmmServer, config.metricsMode, config.databases,
      );
      const { parseConfig: validate } = await import(pathToFileURL(script).href);
      validate(args, {});
    }
  }
});

test('translates pmm-framework flags and drops the ones that no longer apply', () => {
  assert.deepEqual(
    normalizeArgv([
      '--database', 'ps=8.4', '--parallel', '--verbosity-level', '2',
      '--pmm-server-ip=10.0.0.5', '--pmm-server-password', 'secret', '--v',
    ]),
    ['--db', 'ps=8.4', '--pmm-server=10.0.0.5', '--admin-password', 'secret', '--verbose'],
  );
  assert.deepEqual(normalizeArgv(['--verbosity-level=3', '--database=haproxy']), ['--db=haproxy']);
});

test('upper-case underscore option keys resolve to engine flags', () => {
  assert.deepEqual(parseDatabase('ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog').options, {
    'setup-type': 'gr',
    'query-source': 'slowlog',
  });
});

test('retired spec options say where the capability went', () => {
  assert.throws(() => parseDatabase('pdpgsql,PGSM_BRANCH=main'), /build option now/);
});

test('a PXC tarball reaches the build and never the engine', () => {
  const database = parseDatabase('PXC,TARBALL=https://downloads.percona.com/a.tar.gz');
  assert.equal(buildDescriptor(database), 'pxc=8.0,tarball=https://downloads.percona.com/a.tar.gz');
  assert.ok(!provisionerArgs(database, []).includes('--tarball'));
  // A tarball build must not answer to the tag a packaged build already owns.
  assert.notEqual(databaseImage(database), databaseImage(parseDatabase('pxc=8.0')));
});

test('a missing image builds the descriptor its --db implies', () => {
  assert.equal(buildDescriptor(parseDatabase('pdpgsql=14')), 'pdpgsql=14');
  assert.equal(buildDescriptor(parseDatabase('psmdb=7.0,OL_VERSION=8')), 'psmdb=7.0,ol-version=8');
});

test('env vars pmm-framework honoured still win when no flag is given', () => {
  const config = parseConfig([], { ADMIN_PASSWORD: 'from-env', CLIENT_VERSION: '3.9.1-rc' });
  assert.equal(config.adminPassword, 'from-env');
  assert.equal(config.clientVersion, '3.9.1-rc');
  assert.equal(parseConfig(['--admin-password', 'flag'], { ADMIN_PASSWORD: 'env' }).adminPassword, 'flag');
});
