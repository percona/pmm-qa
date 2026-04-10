import { expect, test } from '@playwright/test';
import * as cli from '@helpers/cli-helper';

const MYSQL_USER = 'root';
const MYSQL_PASSWORD = 'GRgrO9301RuF';
let mysqlHosts: string[];
const ipPort = '127.0.0.1:3306';

const grepServicesCmd = (serviceName: string) => {
  return `sudo  pmm-admin list | grep "MySQL" | grep "${serviceName}" | awk -F" " '{print $2}'`;
};

test.describe('PMM Client CLI tests for MySQL', { tag: '@mysql' }, async () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep mysql_pmm | awk \'{print $NF}\'');
    await result.outContains('mysql_pmm', 'MYSQL docker container should exist. please run pmm-framework with --database mysql');
    const result1 = await cli.exec('sudo pmm-admin status');
    await result1.outContains('Running', 'pmm-client is not installed/connected locally, please run pmm3-client-setup script');
    const output = await cli.exec(`sudo pmm-admin add mysql --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} prerequisite ${ipPort}`);
    await output.assertSuccess();
    mysqlHosts = (await cli.exec('sudo pmm-admin list | grep "MySQL" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
  });

  test.afterAll(async ({}) => {
    const output = await cli.exec('sudo pmm-admin remove mysql prerequisite');
    await output.assertSuccess();
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L29
   */
  test('run pmm-admin add mysql based on running instances', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_${n++} ${host}`);
      await output.assertSuccess();
      await output.outContains('MySQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L44
   */
  test('run pmm-admin add mysql again based on running instances', async ({ }) => {
    const hosts = (await cli.exec('sudo  pmm-admin list | grep "MySQL" | grep "mysql_" | awk -F" " \'{print $3}\''))
      .getStdOutLines();
    let n = 1;
    for (const host of hosts) {
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_${n++} ${host}`);
      await output.exitCodeEquals(1);
      await output.outContains('already exists.');
    }
  });

  /**
  * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L58
 */
  test('run pmm-admin remove mysql added using current running instances', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_'))).getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove mysql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L105
   */
  test('run pmm-admin add mysql based on running instances using host, port and service name', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      const ip = host.split(':')[0];
      const port = host.split(':')[1];
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD}  --host=${ip} --port=${port} --service-name=mysql_${n++}`);
      await output.assertSuccess();
      await output.outContains('MySQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L121
   */
  test('run pmm-admin remove mysql added using host, port and service name', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_'))).getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove mysql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L134
   */
  test('PMM-T157 Adding MySQL with specified socket', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      const mysqlPort = host.split(':')[1];
      const mysqlSocketPort = Number(mysqlPort) - 10;
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --socket=/tmp/mysql-sockets/1/mysql.sock --service-name=mysql_socket${n++}`);
      await output.assertSuccess();
      await output.outContains('MySQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L150
   */
  test('Removing MySQL with specified socket', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_socket'))).getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove mysql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L177
   */
  test('run pmm-admin add mysql with both disable-tablestats and disable-tablestats-limit', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      let output = await cli.exec(`sudo  pmm-admin add mysql --query-source=perfschema --disable-tablestats --disable-tablestats-limit=50 --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_both${n++} ${host}`);
      await output.exitCodeEquals(1);
      await output.outContains('both --disable-tablestats and --disable-tablestats-limit are passed');
      output = await cli.exec('sudo  pmm-admin list | grep MySQL');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L191
   */
  test('run pmm-admin add mysql with disable-tablestats', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      let output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --disable-tablestats --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_dis_tablestats${n++} ${host}`);
      await output.assertSuccess();
      await output.outContains('Table statistics collection disabled (always).');
      output = await cli.exec('sudo  pmm-admin list | grep MySQL');
      await output.outContains('mysql_dis_tablestats');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L205
   */
  test('run pmm-admin remove mysql added using disable-tablestats', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_dis_tablestats'))).getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove mysql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L217
   */
  test('run pmm-admin add mysql with disable-tablestats-limit=50', async ({ }) => {
    for (const host of mysqlHosts) {
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --disable-tablestats-limit=50 --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_limit_remove ${host}`);
      await output.assertSuccess();
      await output.outContains('Table statistics collection disabled');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L231
   */
  test('run pmm-admin remove mysql added using disable-tablestats-limit=50', async ({ }) => {
    const output = await cli.exec('sudo pmm-admin remove mysql mysql_limit_remove');
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L243
   */
  test('run pmm-admin remove mysql again', async ({ }) => {
    const output = await cli.exec('sudo pmm-admin remove mysql mysql_limit_remove');
    await output.exitCodeEquals(1);
    await output.outContains('not found.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L255
   */
  test('PMM-T962 run pmm-admin add mysql with --agent-password flag', async ({ }) => {
    let n = 1;
    for (const host of mysqlHosts) {
      const output = await cli.exec(`sudo pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER}  --agent-password=mypass --password=${MYSQL_PASSWORD} mysql_${n++} ${host}`);
      await output.assertSuccess();
      await output.outContains('MySQL Service added.');
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L268
   */
  test.skip('PMM-T962 check metrics from service with custom agent password', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_'))).getStdOutLines();
    for (const service of services) {
      // TODO: add fluent wait
      await cli.exec('sleep 20');
      const metrics = await cli.getMetrics(service, 'pmm', 'mypass', '127.0.0.1');
      const expectedValue = 'mysql_up 1';
      expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
    }
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/ms-specific-tests.bats#L282
   */
  test('run pmm-admin remove mysql added with custom agent password', async ({ }) => {
    const services = (await cli.exec(grepServicesCmd('mysql_'))).getStdOutLines();
    for (const service of services) {
      const output = await cli.exec(`sudo pmm-admin remove mysql ${service}`);
      await output.assertSuccess();
      await output.outContains('Service removed.');
    }
  });
});
