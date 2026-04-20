import { test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

test.describe('HAProxy service CLI tests', { tag: '@haproxy' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep haproxy_pmm | awk \'{print $NF}\'');
    await result.outContains('haproxy_pmm', 'HAPROXY docker container should exist. please run pmm-framework with --database haproxy');
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
  });
  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L5
   */
  test('PMM-T655 - Verify adding HAProxy as service', async ({}) => {
    let output = (await cli.exec('sudo pmm-admin add haproxy --listen-port=42100 haproxyServiceCLI1'));
    await output.assertSuccess();
    await output.outContains('HAProxy Service added.');

    output = await cli.exec('sudo pmm-admin list');
    await output.assertSuccess();
    await output.outContains('external-exporter Unknown');
    await output.outContains('haproxyServiceCLI1');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L17
   */
  test('PMM-T657 - Verify skip-connection-check option while adding HAProxy service', async ({}) => {
    const output = (await cli.exec('sudo pmm-admin add haproxy --listen-port=8455 --skip-connection-check haproxyServiceCLI2'));
    await output.assertSuccess();
    await output.outContains('HAProxy Service added.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L24
   */
  test('Remove HAProxy with connection check', async ({}) => {
    const output = await cli.exec('sudo pmm-admin remove haproxy haproxyServiceCLI2');
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L164
   */
  test('PMM-T656 - Verify adding HAProxy service with wrong port', async ({}) => {
    const output = await cli.exec('sudo pmm-admin add haproxy --listen-port=8444');
    await output.exitCodeEquals(1);
    await output.outContains('Connection check failed: Get "http://127.0.0.1:8444/metrics": dial tcp 127.0.0.1:8444: connect: connection refused.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/haproxy-tests.bats#L171
   */
  test('PMM-T705 - Remove HAProxy service', async ({}) => {
    const output = await cli.exec('sudo pmm-admin remove haproxy haproxyServiceCLI1');
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });
});
