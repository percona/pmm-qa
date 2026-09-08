import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  const mysqlPassword = 'GRgrO9301RuF';
  const newUsername = 'new_pmmm_username';
  const newPassword = 'new_pmm_user_password';
  let containerName: string;
  let serviceName: string;
  let serviceId: string;
  let externalExporterId: string;
  let pgExporterPort: string;
  const pgExporterPassword = 'newAgentPassword';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep external`).stdout.trim();
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep redis_external_service | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep redis_external_service | head -1 | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
    externalExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep external-exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
  });

  // The external exporter is a redis_exporter serving http /metrics on :42200 (see
  // qa-integration/pmm_qa/external_setup.yml). To prove metrics are reachable on a *changed*
  // path/scheme the redis_exporter itself must serve there, so these helpers stop it and relaunch
  // it with extra flags, reusing its original argv captured from /proc.
  const redisExporterPort = '42200';
  const captureRedisExporterCmd = (cliHelper: CliHelper) =>
    cliHelper
      .execSilent(
        `docker exec ${containerName} bash -c 'for p in /proc/[0-9]*; do if [ "$(cat "$p/comm" 2>/dev/null)" = "redis_exporter" ]; then tr "\\0" " " < "$p/cmdline" > /redis_orig_cmd; break; fi; done'`,
      )
      .assertSuccess();
  const stopRedisExporter = (cliHelper: CliHelper) =>
    cliHelper.execSilent(
      `docker exec ${containerName} bash -c 'for p in /proc/[0-9]*; do [ "$(cat "$p/comm" 2>/dev/null)" = "redis_exporter" ] && kill "$(basename "$p")"; done; sleep 2'`,
    );
  const startRedisExporter = (cliHelper: CliHelper, extraFlags: string) =>
    cliHelper
      .execSilent(
        `docker exec -d ${containerName} bash -c 'cd / && $(cat /redis_orig_cmd) ${extraFlags} > /redis_reconfig.log 2>&1'`,
      )
      .assertSuccess();
  const waitForRedisMetrics = (cliHelper: CliHelper, url: string) =>
    cliHelper
      .execSilent(
        `docker exec ${containerName} bash -c 'timeout 60 bash -c "until curl -skf ${url} >/dev/null 2>&1; do sleep 2; done"'`,
      )
      .assertSuccess();

  pmmTest(
    'PMM-T1001 - Verify Change agent username and password @ps-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "CREATE USER '${newUsername}'@'localhost' IDENTIFIED BY '${newPassword}-wrong'; GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'localhost'; FLUSH PRIVILEGES;"`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).outContains('Access denied for user'));

      cliHelper.execSilent(
        `docker exec ${containerName} mysql -u root -p${mysqlPassword} -e "ALTER USER '${newUsername}'@'localhost' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;"`,
      );

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=${newUsername}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T1002 - Verify Change agent custom labels @external-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_mysqld_exporter';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --custom-labels=${customLabel}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(externalExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
    },
  );

  pmmTest('PMM-T1004 - Verify Change agent debug, trace and json @ps-integration', async ({ cliHelper }) => {
    const commands = [
      `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --debug --trace --json`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });

  pmmTest(
    'PMM-T1005 - Verify Change agent enable true/false @ps-integration',
    async ({ cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable=true', response: '- enabled agent', status: 'Running' },
        { command: '--enable=false', response: '- disabled agent', status: 'Done (disabled)' },
        { command: '--enable', response: '- enabled agent', status: 'Running' },
      ];

      for (const enableCommand of enableCommands) {
        let commands = [
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} ${enableCommand.command}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.response);
        }

        // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        commands = [
          `docker exec ${containerName} pmm-admin list | grep external-exporter | grep ${serviceId}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.status);
        }
      }
    },
  );

  pmmTest(
    'PMM-T1008 - Verify Change agent push metrics @external-integration',
    async ({ cliHelper, page }) => {
      pgExporterPort = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${externalExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --push-metrics`,
        )
        .assertSuccess()
        .outContains('- enabled push metrics');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await cliHelper
        .execSilent(
          `docker exec pmm-server curl -u pmm:${pgExporterPassword} http://${containerName}:${pgExporterPort}/metrics`,
        )
        .assertSuccess()
        .outContains('mysql_up');
      await cliHelper
        .execSilent(
          `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
        )
        .outEquals('');
      await cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin list | grep ${externalExporterId}`)
        .outContains('Running');
    },
  );

  pmmTest(
    'PMM-T1013 - Verify Change agent skip connection check @external-integration',
    async ({ cliHelper, grafanaHelper, page, servicesPage }) => {
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=invalid_skip_check_password --skip-connection-check`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=${newUsername}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess();
      }

      await grafanaHelper.authorize();
      await page.goto(servicesPage.url);
      await servicesPage.waitForServiceStatus(serviceName, 'Up', Timeouts.TWO_MINUTES);
    },
  );

  pmmTest(
    'PMM-T1011 - Verify Change agent pmm agent listen port @external-integration',
    async ({ cliHelper }) => {
      let commands = [
        `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
        `docker restart ${containerName}`,
        `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --pmm-agent-listen-port=7778`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest(
    'PMM-T99103 - Verify Change agent server url and server insecure tls @external-integration',
    async ({ cliHelper }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --server-url=${serverUrl}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).outContains('tls: failed to verify certificate:');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --server-url=${serverUrl} --server-insecure-tls`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }
    },
  );

  pmmTest('PMM-T1014 - Verify Change agent username @external-integration', async ({ cliHelper }) => {
    const testUsername = 'external_flag_test_user';

    // The change command output echoes the agent config the server stored, so asserting the
    // "Username" field verifies the flag was applied, not just parsed.
    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=${testUsername} --skip-connection-check`,
      )
      .assertSuccess()
      .outContainsNormalizedMany([
        'agent configuration updated.',
        '- updated username',
        `Username : ${testUsername}`,
      ]);

    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --username=${newUsername} --skip-connection-check`,
      )
      .assertSuccess()
      .outContains(`Username : ${newUsername}`);
  });

  pmmTest('PMM-T1015 - Verify Change agent listen port @external-integration', async ({ cliHelper }) => {
    const readPort = () =>
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep ${externalExporterId} | awk -F' ' '{print $6}'`,
        )
        .stdout.trim();
    const originalPort = readPort();
    const newPort = '42201';

    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --listen-port=${newPort} --skip-connection-check`,
      )
      .assertSuccess()
      .outContainsNormalizedMany([`- changed listen port to ${newPort}`, `Listen port : ${newPort}`]);
    // Independently confirm the new port via pmm-admin list.
    expect(readPort(), 'Listen port should be updated in pmm-admin list').toEqual(newPort);

    await cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --listen-port=${originalPort} --skip-connection-check`,
      )
      .assertSuccess()
      .outContains(`- changed listen port to ${originalPort}`);
    expect(readPort(), 'Listen port should be restored in pmm-admin list').toEqual(originalPort);
  });

  pmmTest('PMM-T1016 - Verify Change agent metrics scheme @external-integration', async ({ cliHelper }) => {
    const httpsUrl = `https://127.0.0.1:${redisExporterPort}/metrics`;
    const httpUrl = `http://127.0.0.1:${redisExporterPort}/metrics`;

    captureRedisExporterCmd(cliHelper);

    try {
      // Serve the redis_exporter over TLS with a self-signed certificate.
      cliHelper
        .execSilent(
          `docker exec ${containerName} bash -c 'openssl req -x509 -newkey rsa:2048 -nodes -keyout /redis_tls.key -out /redis_tls.crt -days 1 -subj "/CN=${containerName}" >/dev/null 2>&1'`,
        )
        .assertSuccess();
      stopRedisExporter(cliHelper);
      startRedisExporter(
        cliHelper,
        '-tls-server-cert-file=/redis_tls.crt -tls-server-key-file=/redis_tls.key',
      );
      await waitForRedisMetrics(cliHelper, httpsUrl);

      // Metrics are served on the changed (https) scheme.
      await cliHelper
        .execSilent(`docker exec ${containerName} curl -skf ${httpsUrl}`)
        .assertSuccess()
        .outContains('redis_up');

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --metrics-scheme=https --skip-connection-check`,
        )
        .assertSuccess()
        .outContainsNormalizedMany(['- changed metrics scheme to https', 'Scheme : https']);
    } finally {
      stopRedisExporter(cliHelper);
      startRedisExporter(cliHelper, '');
      await waitForRedisMetrics(cliHelper, httpUrl);
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --metrics-scheme=http --skip-connection-check`,
        )
        .assertSuccess()
        .outContainsNormalizedMany(['- changed metrics scheme to http', 'Scheme : http']);
    }
  });

  pmmTest('PMM-T1017 - Verify Change agent metrics path @external-integration', async ({ cliHelper }) => {
    const customPath = '/custom-metrics';
    const customUrl = `http://127.0.0.1:${redisExporterPort}${customPath}`;
    const defaultUrl = `http://127.0.0.1:${redisExporterPort}/metrics`;

    captureRedisExporterCmd(cliHelper);

    try {
      // Serve the redis_exporter metrics on a custom telemetry path.
      stopRedisExporter(cliHelper);
      startRedisExporter(cliHelper, `-web.telemetry-path=${customPath}`);
      await waitForRedisMetrics(cliHelper, customUrl);

      // Metrics are served on the changed path.
      await cliHelper
        .execSilent(`docker exec ${containerName} curl -sf ${customUrl}`)
        .assertSuccess()
        .outContains('redis_up');

      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --metrics-path=${customPath} --skip-connection-check`,
        )
        .assertSuccess()
        .outContainsNormalizedMany([
          `- changed metrics path to ${customPath}`,
          `Metrics path : ${customPath}`,
        ]);
    } finally {
      stopRedisExporter(cliHelper);
      startRedisExporter(cliHelper, '');
      await waitForRedisMetrics(cliHelper, defaultUrl);
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent external-exporter ${externalExporterId} --metrics-path=/metrics --skip-connection-check`,
        )
        .assertSuccess()
        .outContainsNormalizedMany(['- changed metrics path to /metrics', 'Metrics path : /metrics']);
    }
  });
});
