import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import { readZipFile } from '@helpers/zip-helper';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = async () => ((await cli.exec('docker ps')).stdout.includes('pdpgsql_pmm_') ? '127.0.0.1:5432' : '127.0.0.1:5447');

test.describe('PMM Client "Generic" CLI tests', { tag: '@generic' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep pdpgsql_pmm | awk \'{print $NF}\'');
    await result.outContains('pdpgsql_pmm', 'PDPGSQL docker container should exist. please run pmm-framework with --database pdpgsql');
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('pmm-admin', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });

  let PMM_VERSION = `${process.env.CLIENT_VERSION}`;
  if (/3-dev-latest|pmm3-rc|https:/.test(PMM_VERSION)) {
    // TODO: refactor to use docker hub API to remove file-update dependency
    // See: https://github.com/Percona-QA/package-testing/blob/master/playbooks/pmm2-client_integration_upgrade_custom_path.yml#L41
    PMM_VERSION = cli.execute('curl -s https://raw.githubusercontent.com/Percona-Lab/pmm-submodules/v3/VERSION')
      .stdout.trim();
  }

  test('Verify pt summary for mysql mongodb and pgsql', async ({}) => {
    await test.step('Verify pt summary returns correct exit code', async () => {
      const ptMysqlSummary = await cli.exec('sudo /usr/local/percona/pmm/tools/pt-mysql-summary --version');
      await ptMysqlSummary.assertSuccess();

      const ptPgSummary = await cli.exec('sudo /usr/local/percona/pmm/tools/pt-pg-summary --version');
      await ptPgSummary.assertSuccess();

      const ptMongoDbSummary = await cli.exec('sudo /usr/local/percona/pmm/tools/pt-mongodb-summary --version');
      await ptMongoDbSummary.assertSuccess();
    });
  });

  test('PMM-T1258 Verify pmm-admin status shows node name', async ({}) => {
    const output = await cli.exec('sudo pmm-admin status');
    await output.assertSuccess();
    await output.outContains('Node name: ');
  });

  test('Verify pmm-server container image size in not more than 2.8GB', async ({}) => {
    const maxSizeBytes = 2.8 * 1024 * 1024 * 1024;
    const imageList = await cli.exec('docker image ls --format "{{.Repository}} {{.ID}}" | grep "pmm-server" | head -1');
    const imageId = imageList.stdout.trim().split(/\s+/).pop();
    expect(imageId, `pmm-server image not found. Output: ${imageList.stdout}`).toBeTruthy();

    const sizeOutput = await cli.exec(`docker image inspect --format '{{.Size}}' ${imageId}`);
    await sizeOutput.assertSuccess();
    const sizeBytes = parseInt(sizeOutput.stdout.trim(), 10);
    expect(sizeBytes, `Image size ${(sizeBytes / 1024 / 1024 / 1024).toFixed(2)}GB exceeds 2.8GB`).toBeLessThanOrEqual(maxSizeBytes);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L8
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L18
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L28
   */
  test('run pmm-admin without any arguments @client-generic', async ({}) => {
    const sudo = (parseInt((await cli.exec('id -u')).stdout, 10) === 0) ? '' : 'sudo ';
    const output = await cli.exec(`${sudo}pmm-admin`);
    await output.outContains('Usage: pmm-admin <command>');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L35
   */
  test('run pmm-admin help', async ({}) => {
    const output = await cli.exec('sudo pmm-admin --help');
    await output.assertSuccess();
    await output.outContains('Usage: pmm-admin <command>');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L42
   */
  test('run pmm-admin -h', async ({}) => {
    const output = await cli.exec('sudo pmm-admin -h');
    await output.assertSuccess();
    await output.outContains('Usage: pmm-admin <command>');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L49
   */
  test('run pmm-admin with wrong option', async ({}) => {
    const output = await cli.exec('sudo pmm-admin install');
    await output.stderr.contains('pmm-admin: error: unexpected argument install');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L56
   */
  test('run pmm-admin list to check for available services', async ({}) => {
    const output = await cli.exec('sudo pmm-admin list');
    await output.assertSuccess();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L62
   */
  test('run pmm-admin --version', async ({}) => {
    const output = await cli.exec('sudo pmm-admin --version');
    await output.assertSuccess();
    await output.outContains(`Version: ${PMM_VERSION}`);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L70
   */
  test('run pmm-admin summary --help', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --help');
    await output.assertSuccess();
    await output.outContains('Usage: pmm-admin summary');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L77
   */
  test('run pmm-admin summary -h', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary -h');
    await output.assertSuccess();
    await output.outContains('Usage: pmm-admin summary');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L84
   */
  test('run pmm-admin summary --version', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --version');
    await output.assertSuccess();
    await output.outContains(`Version: ${PMM_VERSION}`);
  });

  test('PMM-T1219 - verify pmm-admin summary includes targets from vmagent', async ({}) => {
    let output = await cli.exec('sudo pmm-admin summary --filename=pmm-summary.zip');
    await output.assertSuccess();
    await output.outContains('pmm-summary.zip created.');

    output = await cli.exec('unzip pmm-summary.zip -d pmm-summary-logs');
    await output.assertSuccess();

    await test.step('@PMM-T1353 Verify pmm-admin summary doesn\'t save any credentials in files', async () => {
      output = await cli.exec('cat pmm-summary-logs/client/status.json | grep \'"https://x*:x*@.*:.*"\'');
      await output.assertSuccess();
      expect(output.getStdOutLines().length).toBeGreaterThan(0);
    });

    output = await cli.exec('unzip -l pmm-summary.zip | grep vmagent-targets');
    await output.assertSuccess();
    await output.outContainsMany(['client/vmagent-targets.json', 'client/vmagent-targets.html']);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L91
   */
  test('run pmm-admin status and strict check version admin in output', async ({}) => {
    test.skip(true, 'The version number for Feature Build can never be strict matched since packages are downloaded via tarball hence need to skip');
    const output = await cli.exec('sudo pmm-admin status | grep pmm-admin | awk -F\' \' \'{print $3}\'');
    await output.assertSuccess();
    await output.outEquals(PMM_VERSION);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L97
   */
  test('run pmm-admin status and strict check version agent in output', async ({}) => {
    test.skip(true, 'The version number for Feature Build can never be strict matched since packages are downloaded via tarball hence need to skip');
    const output = await cli.exec('sudo pmm-agent status | grep pmm-admin | awk -F\' \' \'{print $3}\'');
    await output.assertSuccess();
    await output.outEquals(PMM_VERSION);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L112
   */
  test('run pmm-admin summary --server-url with https and verify warning', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --server-url=\'https://admin:admin@localhost\'');
    await output.assertSuccess();
    await output.stderr.contains('certificate signed by unknown authority');
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L120
   */
  test('run pmm-admin summary --server-url --server-insecure-tls with https', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --server-url=\'https://admin:admin@localhost\' --server-insecure-tls');
    await output.assertSuccess();
    // there are problems with certificate Get "https://localhost/logs.zip": x509: certificate is not valid for any names,
    // but wanted to match localhost. Despite error archive s still created
    await output.outContains('.zip created.');
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    const filesInZip = await readZipFile(zipName);
    expect(filesInZip, `Verify there are 47 files in ${zipName}.\n ${JSON.stringify(filesInZip, null, 2)}`).toHaveLength(47);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L129
   */
  test('run pmm-admin summary --debug', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --debug');
    await output.assertSuccess();
    // there are no request for those urls. but there are requests for /local/status
    await output.stderr.containsMany([
      'GET /v1/inventory/services',
      'GET /v1/inventory/agents',
    ]);
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L138
   */
  test('run pmm-admin summary --trace', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --trace');
    await output.assertSuccess();
    // there are no request for those urls. but there are requests for /local/status
    await output.stderr.containsMany([
      '(*Runtime).Submit() GET /v1/inventory/services',
      '(*Runtime).Submit() GET /v1/inventory/agents',
    ]);
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L147
   */
  test('run pmm-admin summary --json', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --json');
    await output.assertSuccess();
    /* eslint-disable-next-line no-useless-escape */
    await output.outContains('{\"filename\":\"');
    /* eslint-disable-next-line no-useless-escape */
    await output.outContains('.zip\"}');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L155
   */
  test('run pmm-admin summary --filename empty', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --filename=""');
    await output.assertSuccess();
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L162
   */
  test('PMM-T1832 run pmm-admin summary --filename', async ({}) => {
    const zipName = 'test.zip';
    const output = await cli.exec(`sudo pmm-admin summary --filename="${zipName}"`);
    await output.assertSuccess();
    await output.outContains('.zip created.');
    await output.stderr.isEmpty();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L169
   */
  test('run pmm-admin summary --filename=testformat.txt and verify generated file is a ZIP archive', async ({}) => {
    const FILENAME = 'testformat.txt';
    const output = await cli.exec(`sudo pmm-admin summary --filename="${FILENAME}"`);
    await output.assertSuccess();
    await output.outContains(`${FILENAME} created.`);
    const output2 = await cli.exec(`file ${FILENAME}`);
    await output2.outContains(`${FILENAME}: Zip archive data, at least v2.0 to extract`);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L179
   */
  test('run pmm-admin summary --filename --skip-server', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --filename="test.zip" --skip-server');
    await output.assertSuccess();
    await output.outContains('.zip created.');
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(await readZipFile(zipName), `Verify there are 10 files in ${zipName}`).toHaveLength(10);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L188
   */
  test('run pmm-admin summary --skip-server', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --skip-server');
    await output.assertSuccess();
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L195
   */
  test('run pmm-admin summary --skip-server --trace', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --skip-server --trace');
    await output.assertSuccess();
    await output.stderr.containsMany([
      '(*Runtime).Submit() GET /v1/inventory/services',
      '(*Runtime).Submit() GET /v1/inventory/agents']);
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L204
   */
  test('run pmm-admin summary --skip-server --debug', async ({}) => {
    const output = await cli.exec('sudo pmm-admin summary --skip-server --debug');
    await output.assertSuccess();
    await output.stderr.containsMany([
      'GET /v1/inventory/services',
      'GET /v1/inventory/agents']);
    await output.outContains('.zip created.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L213
   */
  test('run pmm-admin summary --skip-server --json --debug --filename=json_export.zip', async ({}) => {
    const ZIP_FILE_NAME = 'json_export.zip';
    const output = await cli.exec(`sudo pmm-admin summary --skip-server --json --debug --filename=${ZIP_FILE_NAME}`);
    await output.assertSuccess();
    await output.stderr.containsMany([
      'GET /v1/inventory/services',
      'GET /v1/inventory/agents']);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L222
   */
  test('run pmm-admin summary --pprof', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof');
    await output.assertSuccess();
    await output.outContains('.zip created.');
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
    expect(readZipFile(zipName), `Verify there are 43 files in ${zipName}`).toHaveLength(43);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L233
   */
  test('run pmm-admin summary --pprof --trace', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof --trace');
    await output.assertSuccess();
    await output.outContainsMany([
      '(*Runtime).Submit() GET /v1/inventory/services',
      '(*Runtime).Submit() GET /v1/inventory/agents',
      '.zip created.']);
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L245
   */
  test('run pmm-admin summary --pprof --debug', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof --debug');
    await output.assertSuccess();
    await output.outContainsMany([
      'GET /v1/inventory/services',
      'GET /v1/inventory/agents',
      '.zip created.']);
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L257
   */
  test('run pmm-admin summary --pprof --server-url with http', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof --server-url=\'http://admin:admin@localhost\'');
    await output.assertSuccess();
    await output.outContains('.zip created.');
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
    expect(readZipFile(zipName), `Verify there are 43 files in ${zipName}`).toHaveLength(43);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L268
   */
  test('run pmm-admin summary --pprof --json', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof --json');
    await output.assertSuccess();
    /* eslint-disable-next-line no-useless-escape */
    await output.outContainsMany(['{\"filename\":\"', '.zip\"']);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L277
   */
  test('run pmm-admin summary --pprof --filename', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const zipName = 'test_pprof.zip';
    const output = await cli.exec(`sudo pmm-admin summary --pprof --filename="${zipName}"`);
    await output.assertSuccess();
    await output.outContains(`${zipName} created.`);
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L287
   */
  test('run pmm-admin summary --pprof --skip-server', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const output = await cli.exec('sudo pmm-admin summary --pprof --skip-server');
    await output.assertSuccess();
    await output.outContains('.zip created.');
    const zipName = output.getStdOutLines().find((item) => item.includes('.zip created.'))!
      .split(' ').at(0) ?? '';
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
    expect(readZipFile(zipName), `Verify there are 8 files in ${zipName}`).toHaveLength(8);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L298
   */
  test('run pmm-admin summary --pprof --debug --filename --skip-server', async ({}) => {
    test.skip(true, 'skipping because -pprof flag takes a lot of time');
    const zipName = 'test_pprof_complex.zip';
    const output = await cli.exec(`pmm-admin summary --pprof --debug --filename=${zipName} --skip-server`);
    await output.assertSuccess();
    await output.outContainsMany([
      'GET /v1/inventory/services',
      'GET /v1/inventory/agents',
      `${zipName} created.`]);
    expect(readZipFile(zipName), `Verify 'client/pprof/' is present in ${zipName}`).toContain('client/pprof/');
    expect(readZipFile(zipName), `Verify there are 8 files in ${zipName}`).toHaveLength(8);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L321
   */
  test('run pmm-admin annotate \'pmm-testing-check\'', async ({}) => {
    const output = await cli.exec('sudo pmm-admin annotate "pmm-testing-check"');
    await output.assertSuccess();
    await output.outContains('Annotation added.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L328
   */
  test('run pmm-admin annotate with text and tags, verify that it should work', async ({}) => {
    const output = await cli.exec('sudo pmm-admin annotate --tags="testing" "testing-annotate"');
    await output.assertSuccess();
    await output.outContains('Annotation added.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L342
   */
  test('run pmm-admin annotate without any text and verify it should not work', async ({}) => {
    const output = await cli.exec('sudo pmm-admin annotate');
    await output.stderr.contains('pmm-admin: error: expected "<text>"');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L349
   */
  test('run pmm-admin annotate with tags without text cannot be added', async ({}) => {
    const output = await cli.exec('sudo pmm-admin annotate --tags="testing"');
    await output.stderr.contains('pmm-admin: error: expected "<text>"');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L375
   */
  test('Check that pmm-managed database encoding is UTF8', async ({}) => {
    const [ipAddress, port] = (await ipPort()).split(':');
    const output = await cli.exec(
      `export PGPASSWORD=${PGSQL_PASSWORD}; psql -h ${ipAddress} -p ${port} -U ${PGSQL_USER} -d template1 -c 'SHOW SERVER_ENCODING' | grep UTF8`,
    );
    await output.assertSuccess();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L379
   */
  test('Check that template1 database encoding is UTF8', async ({}) => {
    const [ipAddress, port] = (await ipPort()).split(':');
    const output = await cli.exec(
      `export PGPASSWORD=${PGSQL_PASSWORD}; psql -h ${ipAddress} -p ${port} -U ${PGSQL_USER} -d template1 -c 'SHOW SERVER_ENCODING' | grep UTF8`,
    );
    await output.assertSuccess();
  });

  test('PMM-T2025 - Verify that Nomad server is not running by default', async ({}) => {
    const output = await cli.exec('docker exec pmm-server supervisorctl status | grep "nomad-server"');
    await output.exitCodeEquals(1);
  });

  test('PMM-T2031 - Verify that nomad is not listed in pmm-admin list, when not used.', async ({}) => {
    const output = await cli.exec('sudo pmm-admin list');
    await output.assertSuccess();
    await output.outNotContains('nomad');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L383
   */
  test('run pmm-admin config without parameters package installation', async ({}) => {
    // FIXME: PMM-12950
    test.skip(true, 'test is broken, see: PMM-12950');
    const isTarball: boolean = (await cli.exec('systemctl list-units --state running | grep -q "pmm-agent"')).code === 1;
    test.skip(isTarball, 'Skipping this test, because pmm2-client is a tarball setup');
    const output = await cli.exec('sudo pmm-admin config');
    await output.assertSuccess();
    await output.outContains('pmm-agent is running.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/generic-tests.bats#L393
   */
  test('run pmm-admin config without parameters tarball installation', async ({}) => {
    // FIXME: PMM-12950
    test.skip(true, 'test is broken, see: PMM-12950');
    // TODO: move out to function which will handle all linux types
    const isPackage: boolean = (await cli.exec('systemctl list-units --state running | grep -q "pmm-agent"')).code === 0;
    test.skip(isPackage, 'Skipping this test, because pmm2-client is a package installation');
    const output = await cli.exec('sudo pmm-admin config');
    await output.exitCodeEquals(1);
    // no information about failure reasons is shown
    await output.outContains('Failed to register pmm-agent on PMM Server: Node with name');
  });

  test('PMM-T2193 - Verify encrypted PMM Client config file', async ({}) => {
    const container = (await cli.exec('docker ps --format \'{{.Names}}\' | grep ps_pmm')).getStdOutLines()[0];
    const serviceName = (await cli.exec(`docker exec ${container} pmm-admin list | grep "ps_pmm" | awk -F" " '{print $2}'`)).getStdOutLines()[0];
    const serviceId = (await cli.exec(`docker exec ${container} pmm-admin list | grep "ps_pmm" | awk -F" " '{print $4}'`)).getStdOutLines()[0];
    const agent = (await cli.exec(`docker exec ${container} pmm-admin list | grep ${serviceId} | grep "mysqld_exporter" | awk -F" " '{print $4}'`)).getStdOutLines()[0];
    const output = await cli.exec(`docker exec ${container} cat /usr/local/percona/pmm/config/pmm-agent.yaml | grep "server"`);
    await output.exitCodeEquals(1);

    await expect(async () => {
      const metrics = await cli.getMetrics(serviceName, 'pmm', agent, container);
      const expectedValue = 'mysql_up 1';
      expect(metrics, `Metrics for percona server for MySQL with encrypted pmm client config are not present!`).toContain(expectedValue);
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T2194 - Verify non-encrypted PMM Client config file', async ({}) => {
    const container = (await cli.exec('docker ps --format \'{{.Names}}\' | grep pdpgsql_pmm')).getStdOutLines()[0];
    const serviceName = (await cli.exec(`docker exec ${container} pmm-admin list | grep "pdpgsql_pmm" | awk -F" " '{print $2}'`)).getStdOutLines()[0];
    const serviceId = (await cli.exec(`docker exec ${container} pmm-admin list | grep "pdpgsql_pmm" | awk -F" " '{print $4}'`)).getStdOutLines()[0];
    const agent = (await cli.exec(`docker exec ${container} pmm-admin list | grep ${serviceId} | grep "postgres_exporter" | awk -F" " '{print $4}'`)).getStdOutLines()[0];
    const output = await cli.exec(`docker exec ${container} cat /usr/local/percona/pmm/config/pmm-agent.yaml | grep "server"`);
    await output.exitCodeEquals(0);

    await expect(async () => {
      const metrics = await cli.getMetrics(serviceName, 'pmm', agent, container);
      const expectedValue = 'pg_up{collector="custom_query.hr"} 1';
      expect(metrics, `Metrics for Percona Distribution for PgSQL with non-encrypted pmm client config are not present!`).toContain(expectedValue);
    }).toPass({ intervals: [2_000], timeout: 30_000 });
  });

  test('PMM-T9999 @generic', async ({}) => {
    const containerName = 'tarball_client'
    await cli.exec('docker network create pmm-qa || true');
    await cli.exec('docker network connect pmm-server pmm-qa');
    await cli.exec(`docker run --rm -d --name="${containerName}" --network="pmm-qa" --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw -v /var/lib/containerd antmelekhin/docker-systemd:almalinux-10`);
    const latestVersion = (await cli.exec('wget -q https://registry.hub.docker.com/v2/repositories/percona/pmm-client/tags -O - | jq -r .results[].name | grep -v latest | sort -V | tail -n1')).stdout;
    await cli.exec(`docker cp ../package_tests/scripts/pmm3_client_install_tarball.sh ${containerName}:/`)
    await cli.exec(`docker exec ${containerName} dnf install -y wget`);
    const installResponse = (await cli.exec(`docker exec ${containerName} /pmm3_client_install_tarball.sh -v ${latestVersion}`)).stdout;
    const connectResponse = (await cli.exec(`docker exec ${containerName} pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --force --server-insecure-tls --server-address=pmm-server:8443 --server-username=admin --server-password=admin 127.0.0.1 generic tarball_node`)).stdout;


    console.log(`Latest version: ${latestVersion}`);
    console.log(`Install response is: ${installResponse}`);
    console.log(`Connect response is: ${connectResponse}`);
    console.log((await cli.exec('docker ps -a')).stdout);
  })
});
