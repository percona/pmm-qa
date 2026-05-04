import { test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

test.describe('PMM Client "unregister" CLI tests', { tag: '@unregister' }, async () => {
  test.beforeAll(async ({}) => {
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });

  let PMM_VERSION: string;
  if (process.env.CLIENT_VERSION === '/3-dev-latest/pmm3-rc|3.0.*|https:/') {
    // TODO: refactor to use docker hub API to remove file-update dependency
    // See: https://github.com/Percona-QA/package-testing/blob/master/playbooks/pmm2-client_integration_upgrade_custom_path.yml#L41
    PMM_VERSION = cli.execute('curl -s https://raw.githubusercontent.com/Percona-Lab/pmm-submodules/v3/VERSION')
      .stdout.trim();
  }

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L5
   */
  test('run pmm-admin --version --json', async ({}) => {
    const output = await cli.exec('sudo pmm-admin --version --json');
    await output.assertSuccess();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L10
   */
  test('run pmm-admin --version --json and grep PMMVersion', async ({}) => {
    test.skip(!PMM_VERSION, 'Skipping version check because client version is not dev-latest');
    const output = await cli.exec('sudo pmm-admin --version --json');
    await output.assertSuccess();
    await output.outContains(PMM_VERSION);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L21
   */
  test('run pmm-admin --version --json and validate json output with jq', async ({}) => {
    const output = await cli.exec('sudo pmm-admin --version --json');
    await output.assertSuccess();
    // await cli.exec(`echo ${output.stdout} | jq -e .`);
    JSON.parse(output.stdout);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L36
   */
  test('run pmm-admin unregister', async ({}) => {
    const output = await cli.exec('sudo pmm-admin unregister');
    await output.exitCodeEquals(1);
    await output.outContainsMany([
      'Node with ID',
      'has agents.',
    ]);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L44
   */
  test('run pmm-admin unregister wrong node name and json', async ({}) => {
    const output = await cli.exec('sudo pmm-admin unregister --node-name=Testing --json --force');
    await output.exitCodeEquals(1);
    await output.outContains('node Testing is not found');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L51
   */
  test('run pmm-admin unregister --force --node-name=pmm-server', async ({}) => {
    const output = await cli.exec('sudo pmm-admin unregister --force --node-name=pmm-server');
    await output.exitCodeEquals(1);
    await output.outContains('PMM Server node can\'t be removed.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pmm-admin-unregister-tests.bats#L58
   */
  test('run pmm-admin unregister with --force', async ({}) => {
    const output = await cli.exec('sudo pmm-admin unregister --force');
    await output.assertSuccess();
    await output.outContainsMany([
      'Node with ID',
      'unregistered.',
    ]);
  });

  /* PMM-T1900 PMM3 Client pmm-admin unregister w/o force removes nodes */
  test('run pmm-admin status after unregister with --force', async ({}) => {
    const output = await cli.exec('sudo pmm-admin status');
    await output.outContains('Connected : false');
  });
});
