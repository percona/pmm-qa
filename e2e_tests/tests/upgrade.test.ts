import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM upgrade tests for custom password', () => {
  const pdpgsql = { password: 'pmm', username: 'pmm' };
  const mongo = { host: '127.0.0.1', password: 'pmmpass', port: '27027', username: 'pmm' };
  const services = [
    {
      metric: 'mysql_global_status_max_used_connections',
      name: 'ps_pmm_',
      serviceType: 'mysql',
      upgradeService: 'mysql',
    },
    {
      metric: 'pg_stat_database_xact_rollback',
      name: 'pgsql_pgss_pmm',
      serviceType: 'postgresql',
      upgradeService: 'postgresql',
    },
    {
      metric: 'mongodb_connections',
      name: 'rs101',
      serviceType: 'mongodb',
      upgradeService: 'mongodb',
    },
  ];

  for (const service of services) {
    pmmTest(
      `Adding custom agent password, custom label before upgrade at service Level for ${service.serviceType} @pre-upgrade`,
      async ({ api, cliHelper, credentials }) => {
        const details = await api.inventoryApi.getServiceDetailsByPartialName(service.name);
        const pmmAgentId = details.agents.find((agent) => agent.agent_type === 'pmm-agent')?.agent_id;
        const isOvfAmiJob = !!process.env.JOB_NAME && /ami|ovf/.test(process.env.JOB_NAME);
        const address = isOvfAmiJob ? '127.0.0.1' : details.address;

        switch (service.serviceType) {
          case 'mysql':
            cliHelper
              .execute(
                `pmm-admin add mysql --node-id=${details.node_id} --pmm-agent-id=${pmmAgentId} --port=${details.port} --password=${credentials.perconaServer.password} --host=${address} --query-source=perfschema --agent-password=uitests --custom-labels="testing=upgrade" upgrade-${service.upgradeService}`,
              )
              .assertSuccess();
            break;
          case 'postgresql':
            cliHelper
              .execute(
                `pmm-admin add postgresql --username=${pdpgsql.username} --password=${pdpgsql.password} --node-id=${details.node_id} --pmm-agent-id=${pmmAgentId} --port=${details.port} --host=${address} --agent-password=uitests --custom-labels="testing=upgrade" upgrade-${service.upgradeService}`,
              )
              .assertSuccess();
            break;
          case 'mongodb':
            cliHelper
              .execute(
                `pmm-admin add mongodb --username=${mongo.username} --password="${mongo.password}" --port=${mongo.port} --host=${mongo.host} --agent-password=uitests --custom-labels="testing=upgrade" upgrade-${service.upgradeService}`,
              )
              .assertSuccess();
            break;
          default:
        }
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `Verify if Agents added with custom password and custom label work as expected Post Upgrade for ${service.serviceType} @post-client-upgrade @post-upgrade`,
      async ({ api }) => {
        const details = await api.inventoryApi.getServiceDetailsByPartialName(
          `upgrade-${service.upgradeService}`,
        );
        const customLabels = details.custom_labels as unknown as Record<string, string>;

        await api.grafanaApi.waitForMetric(service.metric, details.service_name);
        expect(
          customLabels,
          `Custom labels for ${service.serviceType} added before upgrade are empty`,
        ).toBeTruthy();
        expect(
          customLabels.testing,
          `Custom label "testing=upgrade" was not retained post upgrade for ${service.serviceType}`,
        ).toEqual('upgrade');
      },
    );
  }

  pmmTest(
    'PMM-T1189 - verify user is able to change password after upgrade @post-upgrade',
    async ({ grafanaHelper, page }) => {
      const currentPass = process.env.ADMIN_PASSWORD || 'admin';
      const newPass = process.env.NEW_ADMIN_PASSWORD || 'admin1';

      await grafanaHelper.changePassword(currentPass, newPass);
      await grafanaHelper.authorize('admin', newPass);
      await page.goto('');
      expect(page.url()).toContain('home-dashboard');
      await grafanaHelper.changePassword(newPass, currentPass);
    },
  );
});
