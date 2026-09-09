import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let containerName: string;
  let azureExporterId: string;
  let serviceId: string;

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout.trim();
  });

  // eslint-disable-next-line playwright/expect-expect -- Debug test
  pmmTest('PMM-T1000 Add azure instance @azure-integration', async ({ api, cliHelper }) => {
    await api.settingsApi.enableAzureMonitoring();

    const externalPMMAgentId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin status | grep "Agent ID" | awk -F' ' '{print $4}'`)
      .stdout.trim();
    const resp = await api.managementApi.addAzure({
      address: process.env.PMM_QA_AZURE_MYSQL_HOST,
      az: '',
      azure_client_id: process.env.PMM_QA_AZURE_CLIENT_ID,
      azure_client_secret: process.env.PMM_QA_AZURE_CLIENT_SECRET,
      azure_database_exporter: true,
      azure_resource_group: 'pmm-qa',
      azure_subscription_id: process.env.PMM_QA_AZURE_SUBSCRIPTION_ID,
      azure_tenant_id: process.env.PMM_QA_AZURE_AD_TENANT_ID,
      disable_comments_parsing: true,
      instance_id: `/subscriptions/${process.env.PMM_QA_AZURE_SUBSCRIPTION_ID}/resourceGroups/pmm-qa/providers/Microsoft.DBforMySQL/flexibleServers/pmm2-qa-mysql`,
      isAzure: true,
      metrics_mode: 1,
      node_name: process.env.PMM_QA_AZURE_MYSQL_HOST,
      password: process.env.PMM_QA_AZURE_MYSQL_PASSWORD,
      pmm_agent_id: externalPMMAgentId,
      port: '3306',
      qan: true,
      qan_mysql_perfschema: true,
      region: 'eastus',
      service_name: process.env.PMM_QA_AZURE_MYSQL_HOST,
      tablestatOptions: 'disabled',
      tablestats_group_table_limit: -1,
      type: 'DISCOVER_AZURE_DATABASE_TYPE_MYSQL',
      username: process.env.PMM_QA_AZURE_MYSQL_USERNAME,
    });

    console.log(resp);
    azureExporterId =
      (
        await api.inventoryApi.getServiceDetailsByPartialName(process.env.PMM_QA_AZURE_MYSQL_HOST || '')
      ).agents.find((agent) => agent.agent_type === 'azure_database_exporter')?.agent_id || '';
    console.log(azureExporterId);
    serviceId = (
      await api.inventoryApi.getServiceDetailsByPartialName(process.env.PMM_QA_AZURE_MYSQL_HOST || '')
    ).service_id;
    console.log(serviceId);
  });

  pmmTest(
    'PMM-T1001 - Verify Change agent server url and server insecure tls @azure-integration',
    async ({ cliHelper }) => {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const serverUrl = `https://admin:${adminPassword}@pmm-server:8443/`;
      let commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --server-url=${serverUrl}`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).outContains('tls: failed to verify certificate:');
      }

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --server-url=${serverUrl} --server-insecure-tls`,
      ];

      for (const command of commands) {
        await cliHelper.execSilent(command).assertSuccess().outContains('agent configuration updated.');
      }
    },
  );

  pmmTest(
    'PMM-T1004 - Verify Change agent debug, trace and json @azure-integration',
    async ({ cliHelper }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --debug --trace --json`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );

  pmmTest(
    'PMM-T1003 - Verify Change agent log level @azure-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --log-level=debug`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(azureExporterId);
      await expect(agentsPage.builders.property('log_level=LOG_LEVEL_DEBUG')).toBeVisible();
    },
  );

  pmmTest(
    'PMM-T1005 - Verify Change agent enable true/false @azure-integration',
    async ({ api, cliHelper, page }) => {
      const enableCommands = [
        { command: '--enable=false', response: '- disabled agent', status: 'AGENT_STATUS_DONE' },
        { command: '--enable=true', response: '- enabled agent', status: 'AGENT_STATUS_RUNNING' },
        { command: '--enable=false', response: '- disabled agent', status: 'AGENT_STATUS_DONE' },
        { command: '--enable', response: '- enabled agent', status: 'AGENT_STATUS_RUNNING' },
      ];

      for (const enableCommand of enableCommands) {
        const commands = [
          `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} ${enableCommand.command}`,
        ];

        for (const command of commands) {
          await cliHelper.execSilent(command).assertSuccess().outContains(enableCommand.response);
        }

        // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
        await page.waitForTimeout(Timeouts.TEN_SECONDS);

        await expect(async () => {
          const agentStatus = (
            await api.inventoryApi.getServiceDetailsByPartialName(process.env.PMM_QA_AZURE_MYSQL_HOST || '')
          ).agents.find(
            (agent: { agent_type: string }) => agent.agent_type === 'azure_database_exporter',
          )?.status;

          expect(
            agentStatus,
            `Agent status should be: ${enableCommand.status} but is: ${agentStatus} for command: ${enableCommand.command}`,
          ).toEqual(enableCommand.status);
        }).toPass({
          intervals: [Timeouts.TWO_SECONDS],
          timeout: Timeouts.ONE_MINUTE,
        });
      }
    },
  );

  pmmTest(
    'PMM-T1008 - Verify Change agent push metrics @azure-integration',
    async ({ api, cliHelper, page }) => {
      await cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --push-metrics`,
        )
        .assertSuccess()
        .outContains('- enabled push metrics');

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait for parameter to be propagated to exporter
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      await expect(async () => {
        const agentStatus = (
          await api.inventoryApi.getServiceDetailsByPartialName(process.env.PMM_QA_AZURE_MYSQL_HOST || '')
        ).agents.find(
          (agent: { agent_type: string }) => agent.agent_type === 'azure_database_exporter',
        )?.status;

        expect(agentStatus, `Agent status should be: AGENT_STATUS_RUNNING but is: ${agentStatus}`).toEqual(
          'AGENT_STATUS_RUNNING',
        );
      }).toPass({
        intervals: [Timeouts.TWO_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      });
      await cliHelper
        .execSilent(
          `docker exec ${containerName} cat /var/log/pmm-agent.log | grep vmagent | tail -20 | grep error`,
        )
        .outEquals('');
    },
  );

  pmmTest(
    'PMM-T1002 - Verify Change agent custom labels @azure-integration',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const customLabel = 'env=qa_testing_mysqld_exporter';
      const commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --custom-labels=${customLabel}`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
      await grafanaHelper.authorize();
      await page.goto(agentsPage.url(serviceId));
      await agentsPage.showRowDetails(azureExporterId);
      await expect(agentsPage.builders.property(customLabel)).toBeVisible();
    },
  );

  pmmTest(
    'PMM-T1011 - Verify Change agent pmm agent listen port @azure-integration',
    async ({ cliHelper }) => {
      let commands = [
        `docker exec ${containerName} sed -i 's/listen-port: 7777/listen-port: 7778/' /usr/local/percona/pmm/config/pmm-agent.yaml`,
        `docker restart ${containerName}`,
        `docker exec -d ${containerName} pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());

      commands = [
        `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --pmm-agent-listen-port=7778`,
      ];

      commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
    },
  );
});
