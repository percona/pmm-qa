import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { pmmClientConfig } from './pmm-client.ts';
import { buildDescriptor, databaseImage, normalizeArgv, parseConfig, parseDatabase, provisionerArgs, resolveClientArgs } from './setup.ts';

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

test('pmm-framework type names that provisioning spells differently still resolve', () => {
  assert.equal(parseDatabase('mlaunch_modb=8.0').type, 'mlaunch-mongodb');
  assert.equal(parseDatabase('ssl_mlaunch=8.0').type, 'mlaunch-psmdb');
  assert.equal(parseDatabase('ssl_mlaunch=8.0').options.tls, 'true');
  assert.equal(parseDatabase('modb').type, 'mongodb');
  assert.throws(() => parseDatabase('proxysql'), /part of --db pxc/);
});

test('pmm-framework option names that provisioning spells differently still resolve', () => {
  assert.equal(parseDatabase('ps=8.0,SETUP_TYPE=gr,NODES_COUNT=3').options.nodes, '3');
  assert.equal(parseDatabase('bucket,BUCKET_NAMES=bcp;archive').options.buckets, 'bcp;archive');
});

test('registered-but-unused pmm-framework options are accepted and ignored', () => {
  const mysql = parseDatabase('mysql=8.0,TARBALL=https://example.com/ms.tar.gz');
  assert.equal(buildDescriptor(mysql), 'mysql=8.0');
  assert.equal(databaseImage(mysql), databaseImage(parseDatabase('mysql=8.0')));
  assert.ok(!provisionerArgs(mysql, []).includes('--tarball'));
  assert.ok(provisionerArgs(parseDatabase('pgsql=17,QUERY_SOURCE=pgstatements'), []).includes('--query-source'));
});

test('environment variables outrank the spec, as resolve_value did', () => {
  assert.equal(parseDatabase('ps=8.4', { PS_VERSION: '5.7' }).version, '5.7');
  assert.equal(parseDatabase('ps=8.4,SETUP_TYPE=gr', { SETUP_TYPE: 'replication' }).options['setup-type'], 'replication');
  assert.equal(parseDatabase('ps', { NODES_COUNT: '3' }).options.nodes, '3');
  assert.equal(parseDatabase('bucket', { BUCKET_NAMES: 'one,two' }).options.buckets, 'one,two');
  assert.equal(parseDatabase('pgsql', { PGSQL_VERSION: '14' }).version, '14');
  assert.equal(parseDatabase('mysql', { MS_VERSION: '8.4' }).version, '8.4');
  assert.equal(parseDatabase('valkey', { VALKEY_VERSION: '7' }).version, '7');
  // An option registered for another type must not leak in from the environment.
  assert.deepEqual(parseDatabase('haproxy', { SETUP_TYPE: 'gr' }).options, {});
  // An empty spec version keeps the registered default rather than the environment's empty value.
  assert.equal(parseDatabase('pdpgsql', { PDPGSQL_VERSION: '' }).version, '17');
});

test('a PSMDB_VERSION patch release selects the series and pins the build', () => {
  const database = parseDatabase('psmdb', { PSMDB_VERSION: '8.0.4-1' });
  assert.equal(database.version, '8.0');
  assert.equal(buildDescriptor(database), 'psmdb=8.0,patch=8.0.4-1');
  assert.notEqual(databaseImage(database), databaseImage(parseDatabase('psmdb=8.0')));
  assert.ok(!provisionerArgs(database, []).includes('--patch'));
});

test('dockerclients builds the client images instead of provisioning a database', () => {
  const config = parseConfig(['--database', 'dockerclients'], {});
  assert.equal(config.dockerClients, true);
  assert.deepEqual(config.databases, []);
});

test('a CLIENT_VERSION tarball in the environment does not collide with the resolved flag', async () => {
  // Every runner workflow exports CLIENT_VERSION=latest-tarball. setup.ts resolves that to
  // --client-tarball, and the engine child still inherits the original variable.
  for (const clientVersion of ['latest-tarball', 'https://example.com/pmm-client.tar.gz']) {
    const args = await resolveClientArgs(clientVersion, async () => '/cache/pmm-client.tar.gz');
    assert.deepEqual(args, ['--client-tarball', '/cache/pmm-client.tar.gz']);
    const values = Object.fromEntries([[args[0].slice(2), args[1]]]);
    const config = pmmClientConfig(values, { CLIENT_VERSION: clientVersion });
    assert.equal(config.clientTarball, '/cache/pmm-client.tar.gz');
    assert.equal(config.clientVersion, undefined);
  }
  // A standalone engine run, with no flag, still reads the environment.
  assert.equal(pmmClientConfig({}, { CLIENT_VERSION: '3-dev-latest' }).clientVersion, '3-dev-latest');
});

test('gssapi selects a krb5-linked client, and rejects one that cannot work', () => {
  // Unattended: pick the dynamic tarball matching the image's Oracle Linux major.
  assert.match(
    parseConfig(['--db', 'psmdb,gssapi=true'], {}).databases[0].clientVersion ?? '',
    /pmm-client-dynamic-ol9-latest\.tar\.gz$/,
  );
  assert.match(
    parseConfig(['--db', 'psmdb,gssapi=true,ol-version=8'], {}).databases[0].clientVersion ?? '',
    /pmm-client-dynamic-ol8-latest\.tar\.gz$/,
  );
  // An explicit, correct choice is left alone; the run's global client is used.
  const ol8 = 'https://s3.us-east-2.amazonaws.com/pmm-build-cache/PR-BUILDS/pmm-client/pmm-client-dynamic-ol8-latest.tar.gz';
  assert.equal(
    parseConfig(['--db', 'psmdb,gssapi=true,ol-version=8', '--client-version', ol8], {}).databases[0].clientVersion,
    undefined,
  );
  // The static build is the one that actually failed at `pmm-admin add`.
  assert.throws(
    () => parseConfig(['--db', 'psmdb,gssapi=true'], { CLIENT_VERSION: 'latest-tarball' }),
    /static build.*pmm-client-dynamic-ol9/s,
  );
  // A dynamic tarball for the wrong OL cannot match the image's krb5 libraries.
  assert.throws(
    () => parseConfig(['--db', 'psmdb,gssapi=true,ol-version=9', '--client-version', ol8], {}),
    /built for ol8 but this PSMDB image is ol9/,
  );
  // Without gssapi nothing changes, and GSSAPI arriving by environment is honoured too.
  assert.equal(parseConfig(['--db', 'psmdb'], {}).databases[0].clientVersion, undefined);
  assert.match(
    parseConfig(['--db', 'psmdb'], { GSSAPI: 'true', OL_VERSION: '8' }).databases[0].clientVersion ?? '',
    /dynamic-ol8/,
  );
});
