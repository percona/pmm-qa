import { test, expect } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

const PGSQL_USER = 'postgres';
const PGSQL_PASSWORD = 'pass+this';
const ipPort = async () => ((await cli.exec('docker ps')).stdout.includes('pdpgsql_pmm_') ? '127.0.0.1:5432' : '127.0.0.1:5447');

test.describe('PMM Client CLI tests for PostgreSQL Data Base', { tag: '@pgsql' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep pdpgsql_pmm | awk \'{print $NF}\'');
    await result.outContains('pdpgsql_pmm', 'PDPGSQL docker container should exist. please run pmm-framework with --database pdpgsql');
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
    const output = await cli.exec(`sudo pmm-admin add postgresql --query-source=pgstatmonitor --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} prerequisite ${await ipPort()}`);
    await output.assertSuccess();
  });

  test.afterAll(async ({}) => {
    const output = await cli.exec('sudo pmm-admin remove postgresql prerequisite');
    await output.assertSuccess();
  });
  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L10
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L20
   */
  test('run pmm-admin', async ({}) => {
    const sudo = parseInt((await cli.exec('id -u')).stdout, 10) === 0 ? '' : 'sudo ';
    const output = await cli.exec(`${sudo}pmm-admin`);
    await output.outContains('Usage: pmm-admin <command>');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L30
   */
  test('run pmm-admin add postgresql based on running intsances', async ({}) => {
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const output = await cli.exec(`sudo pmm-admin add postgresql --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} pgsql_${n++} ${host}`);
      await output.assertSuccess();
      await output.outContains('PostgreSQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L43
   */
  test('run pmm-admin add postgresql again based on running instances', async ({}) => {
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const output = await cli.exec(`sudo pmm-admin add postgresql --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} pgsql_${n++} ${host}`);
      await output.exitCodeEquals(1);
      await output.outContains('already exists.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L57
   */
  test('run pmm-admin remove postgresql added with default parameters', async ({}) => {
    const services = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " \'{print $2}\''))
      .getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove postgresql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L90
   */
  test('run pmm-admin add postgresql based on running intsances using host, port and service name', async ({}) => {
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const ip = host.split(':')[0];
      const port = host.split(':')[1];
      const output = await cli.exec(`sudo pmm-admin add postgresql --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} --host=${ip} --port=${port} --service-name=pgsql_${n++}`);
      await output.assertSuccess();
      await output.outContains('PostgreSQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L105
   */
  test('run pmm-admin remove postgresql adding using host, port and service name flags', async ({}) => {
    const services = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " \'{print $2}\''))
      .getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove postgresql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L117
   */
  test('run pmm-admin remove postgresql again', async ({}) => {
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const output = await cli.exec(`sudo pmm-admin remove postgresql pgsql_${n++}`);
      await output.exitCodeEquals(1);
      await output.outContains('not found.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L129
   */
  test('PMM-T963 run pmm-admin add postgresql with --agent-password flag', async ({}) => {
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const ip = host.split(':')[0];
      const port = host.split(':')[1];
      const output = await cli.exec(`sudo pmm-admin add postgresql --username=${PGSQL_USER} --password=${PGSQL_PASSWORD} --agent-password=mypass --host=${ip} --port=${port} --service-name=pgsql_${n++}`);
      await output.assertSuccess();
      await output.outContains('PostgreSQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L144
   */
  test('PMM-T963 check metrics from postgres service with custom agent password', async ({}) => {
    test.skip(true, 'Skipping this test, because of random failure and flaky behaviour');
    const hosts = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    for (const host of hosts) {
      const ip = host.split(':')[0];
      // await (await cli.exec('sudo chmod +x /srv/pmm-qa/pmm-tests/pmm-2-0-bats-tests/check_metric.sh')).assertSuccess();
      // let output = await cli.exec(`./pmm-tests/pmm-2-0-bats-tests/check_metric.sh pgsql_$COUNTER pg_up ${ip} postgres_exporter pmm mypass`);
      // await output.assertSuccess();
      // await output.outContains('pg_up 1');
      const metrics = await cli.getMetrics(host, 'pmm', 'mypass', ip);
      const expectedValue = 'pg_up 1';
      expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/pgsql-specific-tests.bats#L159
   */
  test('PMM-T963 run pmm-admin remove postgresql added with custom agent password', async ({}) => {
    const services = (await cli.exec('sudo pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " \'{print $2}\''))
      .getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove postgresql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });
});
