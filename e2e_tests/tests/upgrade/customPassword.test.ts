import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { RemoteUpgradeInstance } from '@api/remoteInstance.api';

// Shared across the upgrade test files (customPassword + externalService).
export const services: RemoteUpgradeInstance[] = [
  {
    connection: {
      address: 'ps_pmm_8_4_1',
      cluster: 'mysql_clstr',
      password: 'GRgrO9301RuF',
      port: '3306',
      username: 'root',
    },
    metric: 'mysql_global_status_max_used_connections',
    name: 'ps_pmm_',
    serviceType: 'mysql',
    upgradeService: 'mysql',
  },
  {
    connection: {
      address: 'pgsql_pgss_pmm_17',
      cluster: 'pgsql_clstr',
      password: 'pmm',
      port: '5432',
      username: 'pmm',
    },
    metric: 'pg_stat_database_xact_rollback',
    name: 'pgsql_pgss_pmm',
    serviceType: 'postgresql',
    upgradeService: 'postgresql',
  },
  {
    connection: {
      address: 'rs101',
      cluster: 'mongo_clstr',
      password: 'pbmpass',
      port: '27017',
      username: 'pbm',
    },
    metric: 'mongodb_connections',
    name: 'rs101',
    serviceType: 'mongodb',
    upgradeService: 'mongodb',
  },
];


pmmTest.describe('PMM upgrade tests for custom password', () => {
  const pgsql = { host: '127.0.0.1', password: 'pmm', port: '5432', username: 'pmm' };
  const mongo = { host: '127.0.0.1', password: 'pmmpass', port: '27017', username: 'pmm' };
  const mysql = { host: '127.0.0.1', password: 'GRgrO9301RuF', port: '3306', username: 'root' };

  for (const service of services) {
    pmmTest(
      `Adding custom agent password, custom label before upgrade at service Level for ${service.serviceType} @pre-upgrade`,
      async ({ cliHelper, credentials }) => {
        const labels = `--agent-password=uitests --custom-labels="testing=upgrade" upgrade-${service.upgradeService}`;
        const addCommand: Record<string, string> = {
          mongodb: `pmm-admin add mongodb --username=${mongo.username} --password="${mongo.password}" --port=${mongo.port} --host=${mongo.host} ${labels}`,
          mysql: `pmm-admin add mysql --password=${credentials.perconaServer.password} --port=${mysql.port} --host=${mysql.host} --query-source=perfschema ${labels}`,
          postgresql: `pmm-admin add postgresql --username=${pgsql.username} --password=${pgsql.password} --port=${pgsql.port} --host=${pgsql.host} ${labels}`,
        };

        cliHelper
          .execSilent(`docker exec ${service.connection.address} ${addCommand[service.serviceType]}`)
          .assertSuccess();
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `Verify if Agents added with custom password and custom label work as expected Post Upgrade for ${service.serviceType} @post-upgrade @post-client-upgrade`,
      async ({ api }) => {
        const details = await api.inventoryApi.getServiceDetailsByPartialName(
          `upgrade-${service.upgradeService}`,
        );
        const customLabels = details.custom_labels as unknown as Record<string, string>;

        console.log(`Custom labels are: ${JSON.stringify(customLabels)}`);

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
      await grafanaHelper.changePassword(newPass, currentPass);
    },
  );
});
