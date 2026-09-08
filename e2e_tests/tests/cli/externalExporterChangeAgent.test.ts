import pmmTest from '@fixtures/pmmTest';
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
    containerName = cliHelper.execSilent(``).stdout.trim();
    serviceName = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep redis_external_service | head -1 | awk -F' ' '{print $2}'`,
      )
      .stdout.trim();
    serviceId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep redis_external_service | head -1 | awk -F' ' '{print $3}'`,
      )
      .stdout.trim();
    externalExporterId = cliHelper
      .execSilent(
        `docker exec ${containerName} pmm-admin list | grep ${serviceId} | grep external-exporter | awk -F' ' '{print $4}'`,
      )
      .stdout.trim();
  });

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
});
