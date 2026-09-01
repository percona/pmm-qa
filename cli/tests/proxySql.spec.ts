import { test, expect } from '@playwright/test';
import * as cli from '@helpers/cli-helper';
import * as zipHelper from '@helpers/zip-helper';
import { getPmmAdminMinorVersion } from '@root/helpers/pmm-admin';

const PXC_USER = 'admin';
const PXC_PASSWORD = 'admin';
let containerName: string;
const dbHostPort = '127.0.0.1:6032';
const proxysqlServiceName = 'proxysql_1';
let adminVersion: number;
const connectionTimeoutServiceName = 'proxysql_connection_timeout_service';

test.describe('PMM Client CLI tests for ProxySQL', { tag: '@proxysql' }, () => {
  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep pxc_proxysql_pmm | awk \'{print $NF}\'');
    await result.outContains('pxc_proxysql_pmm', 'PROXYSQL docker container should exist. please run pmm-framework with --database pxc');
    containerName = result.stdout.trim();
    adminVersion = await getPmmAdminMinorVersion(containerName);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L10
   */
  test('run pmm-admin add proxysql', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${proxysqlServiceName} ${dbHostPort}`);
    await output.assertSuccess();
    await output.outContains('ProxySQL Service added.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L25
   */
  test('run pmm-admin add proxysql again based on running instances', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${proxysqlServiceName} ${dbHostPort}`);
    await output.exitCodeEquals(1);
    await output.outContains('already exists.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L38
   */
  test('run pmm-admin remove proxysql', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove proxysql ${proxysqlServiceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L51
   */
  test('run pmm-admin remove proxysql again', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove proxysql ${proxysqlServiceName}`);
    await output.exitCodeEquals(1);
    await output.outContains('not found.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L63
   */
  test('PMM-T965 run pmm-admin add proxysql with --agent-password flag', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 --agent-password=mypass ${proxysqlServiceName} ${dbHostPort}`);
    await output.assertSuccess();
    await output.outContains('ProxySQL Service added.');
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L76
   */
  test('PMM-T965 check metrics from proxysql service with custom agent password', async ({}) => {
    await cli.exec('sleep 20');
    const metrics = await cli.getMetrics(proxysqlServiceName, 'pmm', 'mypass', containerName);
    const expectedValue = 'proxysql_up 1';
    expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
  });

  /**
   * @link https://github.com/percona/pmm-qa/blob/main/pmm-tests/pmm-2-0-bats-tests/proxysql-specific-tests.bats#L91
   */
  test('run pmm-admin remove proxysql added with custom agent password', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin remove proxysql ${proxysqlServiceName}`);
    await output.assertSuccess();
    await output.outContains('Service removed.');
  });

  test('PMM-T2158 - verify proxysql monitoring by viewer user', async ({}) => {
    test.skip(adminVersion < 7, 'This test is relevant for pmm-client version 3.7.0 and above');

    const viewerPassword = 'read_user';
    const viewerUsername = 'read_user';
    const serviceName = `viewer_proxysql_${containerName}_${Date.now()}`;

    const serviceId = JSON.parse(
      await cli.executeAndVerify(
        `docker exec ${containerName} pmm-admin add proxysql --username=${viewerUsername} --password=${viewerPassword} --agent-password=mypass --service-name=${serviceName} --host=127.0.0.1 --port=6032 --json`,
      ),
    ).service.service_id;

    await test.step('verify proxysql metrics', async () => {
      await expect(async () => {
        const metrics = await cli.getMetrics(serviceName, 'pmm', 'mypass', containerName);
        const expectedValue = 'proxysql_up 1';
        expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
      }).toPass({
        intervals: [5_000],
        timeout: 60_000,
      });
    });

    await test.step('verify there are no errors in proxysql agent logs', async () => {
      const jsonList = JSON.parse(await cli.executeAndVerify(`docker exec ${containerName} pmm-admin list --json`));
      const { agent_id: agentId } = jsonList
        .agent
        .find(({ agent_type, service_id, status }: { agent_type: string; service_id: string; status: string }) => {
          return service_id === serviceId && agent_type === 'AGENT_TYPE_PROXYSQL_EXPORTER' && status === 'RUNNING';
        });

      await cli.executeAndVerify(`docker exec ${containerName} pmm-admin summary --filename=pmm-summary.zip`, '.zip created.');
      await cli.executeAndVerify(`docker cp ${containerName}:/pmm-summary.zip ./`);
      const logFileContent = await zipHelper.getFileContentFromZip('pmm-summary.zip', `client/pmm-agent/AGENT_TYPE_PROXYSQL_EXPORTER ${agentId}.log`);

      expect(logFileContent.toLowerCase(), 'Log file content does not contain any errors!').not.toContain('error');
    });

    await cli.executeAndVerify(`docker exec ${containerName} pmm-admin remove proxysql ${serviceName}`, 'Service removed.');
  });

  test('PMM-T2221 - User can use connection timeout while using pmm-admin add @connectionTimeoutPXC', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --connection-timeout=5s --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${connectionTimeoutServiceName} ${dbHostPort}`);
    await output.exitCodeEquals(0);

    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout.trim()} | grep proxysql_exporter | awk -F' ' '{print $4}'`);
    await cli.exec('sleep 2');
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /pmm-agent.log | grep ${agentId.stdout.trim()} | grep timeout=5`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2222 - User can change connection timeout using pmm-admin inventory change agent @connectionTimeoutPXC', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep proxysql_exporter | awk -F' ' '{print $4}'`);
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${agentId.stdout} --connection-timeout=4s`);
    await chaneAgent.exitCodeEquals(0);
    await cli.exec('sleep 2');
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /pmm-agent.log | grep ${agentId.stdout.trim()} | grep timeout=4`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2223 - User can clear connection timeout using pmm-admin inventory change agent @connectionTimeoutPXC', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const serviceId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${connectionTimeoutServiceName} | awk -F' ' '{print $4}'`);
    const agentId = await cli.exec(`docker exec ${containerName} pmm-admin list | grep ${serviceId.stdout} | grep proxysql_exporter | awk -F' ' '{print $4}'`);
    await serviceId.exitCodeEquals(0);
    await agentId.exitCodeEquals(0);
    const chaneAgent = await cli.exec(`docker exec ${containerName} pmm-admin inventory change agent proxysql-exporter ${agentId.stdout} --connection-timeout=0s`);
    await chaneAgent.exitCodeEquals(0);
    await cli.exec('sleep 2');
    const dataSourceName = await cli.exec(`docker exec ${containerName} cat /pmm-agent.log | grep ${agentId.stdout.trim()} | grep timeout=2`);
    await dataSourceName.assertSuccess();
  });

  test('PMM-T2224 - Connection timeout is used when adding service with command: pmm-admin add @connectionTimeoutPXC', async ({ }) => {
    test.skip(adminVersion < 8, 'This test is relevant for pmm-client version 3.8.0 and above');
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add proxysql --connection-timeout=5s --username=${PXC_USER} --password=${PXC_PASSWORD} --port=6032 ${connectionTimeoutServiceName}_timeout 195.15.25.15:6032`);
    await output.exitCodeEquals(1);

    expect(
      output.durationMs,
      `Expected pmm-admin to honor --connection-timeout=5s, got ${output.durationMs.toFixed(0)} ms`,
    ).toBeGreaterThan(5_000);
  });

  /**
   * @link https://perconadev.atlassian.net/browse/PMM-15259
   *
   * ProxySQL admin interface (6032) + caching_sha2_password. PXC Operator 1.19
   * set mysql-default_authentication_plugin=caching_sha2_password; the
   * proxysql_exporter connects as the ProxySQL monitor user (operator DSN is
   * monitor:monitor@tcp(localhost:6032)/), NOT as an admin/stats credential.
   * Admin/stats-credential users (admin, read_user) skip the caching_sha2
   * full-auth exchange, so they authenticate on every ProxySQL build -- that is
   * why exercising this bug requires the monitor user. The monitor user goes
   * through full authentication, which ProxySQL could not complete over a
   * non-TLS admin connection until 3.0.11 (it now intercepts the cleartext
   * password during the full-auth exchange). Expected: fails on ProxySQL
   * < 3.0.11 with "perform full authentication", passes on >= 3.0.11.
   */
  test('PMM-15259 - proxysql exporter authenticates as monitor user under caching_sha2_password', async ({}) => {
    const serviceName = `caching_sha2_proxysql_${containerName}_${Date.now()}`;
    const agentPassword = 'mypass';
    const monitorUser = 'monitor';
    const monitorPassword = 'monitor';
    const proxysqlAdmin = `docker exec ${containerName} mysql -h 127.0.0.1 -P 6032 -u ${PXC_USER} -p${PXC_PASSWORD}`;
    let serviceId = '';

    await test.step('configure the monitor user and caching_sha2_password on the admin interface', async () => {
      await cli.executeAndVerify(
        `${proxysqlAdmin} -e "SET mysql-monitor_username='${monitorUser}'; SET mysql-monitor_password='${monitorPassword}'; SET mysql-default_authentication_plugin='caching_sha2_password'; LOAD MYSQL VARIABLES TO RUNTIME; SAVE MYSQL VARIABLES TO DISK;"`,
      );
      const runtimeValue = await cli.executeAndVerify(
        `${proxysqlAdmin} -N -e "SELECT variable_value FROM runtime_global_variables WHERE variable_name='mysql-default_authentication_plugin';"`,
      );
      expect(runtimeValue.trim(), 'ProxySQL is not using caching_sha2_password').toContain('caching_sha2_password');
    });

    try {
      await test.step('add proxysql service as the monitor user (non-TLS, full-auth path)', async () => {
        serviceId = JSON.parse(
          await cli.executeAndVerify(
            `docker exec ${containerName} pmm-admin add proxysql --username=${monitorUser} --password=${monitorPassword} --agent-password=${agentPassword} --service-name=${serviceName} --host=127.0.0.1 --port=6032 --json`,
          ),
        ).service.service_id;
      });

      await test.step('verify proxysql metrics are scraped (monitor user completed caching_sha2 auth)', async () => {
        await expect(async () => {
          const metrics = await cli.getMetrics(serviceName, 'pmm', agentPassword, containerName);
          const expectedValue = 'proxysql_up 1';
          expect(metrics, `Scraped metrics do not contain ${expectedValue}!`).toContain(expectedValue);
        }).toPass({
          intervals: [5_000],
          timeout: 60_000,
        });
      });

      await test.step('verify the caching_sha2_password full-authentication error is absent from the exporter log', async () => {
        const jsonList = JSON.parse(await cli.executeAndVerify(`docker exec ${containerName} pmm-admin list --json`));
        const { agent_id: agentId } = jsonList
          .agent
          .find(({ agent_type, service_id, status }: { agent_type: string; service_id: string; status: string }) => {
            return service_id === serviceId && agent_type === 'AGENT_TYPE_PROXYSQL_EXPORTER' && status === 'RUNNING';
          });

        await cli.executeAndVerify(`docker exec ${containerName} pmm-admin summary --filename=pmm-summary.zip`, '.zip created.');
        await cli.executeAndVerify(`docker cp ${containerName}:/pmm-summary.zip ./`);
        const logFileContent = await zipHelper.getFileContentFromZip('pmm-summary.zip', `client/pmm-agent/AGENT_TYPE_PROXYSQL_EXPORTER ${agentId}.log`);

        expect(
          logFileContent.toLowerCase(),
          'ProxySQL exporter log reports a caching_sha2_password full-authentication failure',
        ).not.toContain('perform full authentication');
      });
    } finally {
      await cli.exec(`docker exec ${containerName} pmm-admin remove proxysql ${serviceName}`);
      await cli.exec(
        `${proxysqlAdmin} -e "SET mysql-default_authentication_plugin='mysql_native_password'; LOAD MYSQL VARIABLES TO RUNTIME; SAVE MYSQL VARIABLES TO DISK;"`,
      );
    }
  });
});
