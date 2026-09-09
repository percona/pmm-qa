import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let containerName: string;
  let azureExporterId: string;
  // let azureExporterPort: string;

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
    // console.log(azureExporterPort);
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

  pmmTest('PMM-T1004 - Verify Change agent debug, trace and json @ps-integration', async ({ cliHelper }) => {
    const commands = [
      `docker exec ${containerName} pmm-admin inventory change agent azure-database-exporter ${azureExporterId} --debug --trace --json`,
    ];

    commands.forEach((command) => cliHelper.execSilent(command).assertSuccess());
  });
});
