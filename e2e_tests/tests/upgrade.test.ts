import pmmTest from '@fixtures/pmmTest';
import { RemoteUpgradeInstance } from '@api/remoteInstance.api';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('PMM upgrade tests', () => {
  const redisServiceName = 'pmm-ui-tests-redis-external-remote';
  const pgsql = { host: '127.0.0.1', password: 'pmm', port: '5432', username: 'pmm' };
  const mongo = { host: '127.0.0.1', password: 'pmmpass', port: '27017', username: 'pmm' };
  const mysql = { host: '127.0.0.1', password: 'GRgrO9301RuF', port: '3306', username: 'root' };
  const services: RemoteUpgradeInstance[] = [
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
      `Verify if Agents added with custom password and custom label work as expected Post Upgrade for ${service.serviceType} @post-upgrade`,
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

  pmmTest('Adding Redis as external Service before Upgrade @pre-upgrade', async ({ api, cliHelper }) => {
    await api.remoteInstanceApi.addRemoteInstance({
      external: {
        add_node: { node_name: redisServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: 'external_pmm',
        cluster: 'redis_external_exporter',
        group: 'redis-remote',
        listen_port: '42200',
        metrics_path: '/metrics',
        schema: 'http',
        service_name: redisServiceName,
      },
    });

    cliHelper
      .execSilent(
        `docker exec external_pmm pmm-admin add external --listen-port=42200 --group="redis" --custom-labels="testing=redis" --service-name=${redisServiceName}-2`,
      )
      .assertSuccess();
  });

  for (const service of services) {
    pmmTest(
      `PMM-T2074 - Verify user can create Remote Instance ${service.serviceType} before upgrade @pre-upgrade`,
      async ({ api }) => {
        const remoteInstance = api.remoteInstanceApi.buildRemoteInstanceDataBody(service);

        await api.remoteInstanceApi.addRemoteInstance(remoteInstance);
      },
    );
  }

  pmmTest('Verify Redis as external Service Works After Upgrade @post-upgrade', async ({ api }) => {
    const metricName = 'redis_uptime_in_seconds';

    await api.grafanaApi.waitForMetric(metricName);
    await api.grafanaApi.waitForMetric(metricName, `${redisServiceName}-2`);

    const target = await api.grafanaApi.getActiveTargetByExternalGroup('redis-remote');
    const expectedScrapeUrl = 'http://external_pmm:42200/metrics';

    expect(
      target.scrapeUrl,
      `Active Target for external service Post Upgrade has wrong Address value, found ${target.scrapeUrl}`,
    ).toEqual(expectedScrapeUrl);
    await expect
      .poll(async () => (await api.grafanaApi.getActiveTargetByExternalGroup('redis-remote'))?.health, {
        message: 'Active Target for external service Post Upgrade health value is not up!',
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBe('up');
  });

  for (const service of services) {
    pmmTest(
      `PMM-T2073 - Verify Agents are RUNNING after Upgrade (API) for ${service.serviceType} @post-upgrade`,
      async ({ api }) => {
        await expect
          .poll(() => api.inventoryApi.verifyAgentsAreRunning(`upgrade-${service.upgradeService}`), {
            message: `One or more agents are not running for upgrade-${service.upgradeService}`,
            timeout: Timeouts.TWO_MINUTES,
          })
          .toBe(true);
      },
    );
  }

  for (const service of services) {
    pmmTest(
      `PMM-T2071 - Verify Agents are Running and Metrics are being collected Pre and Post Upgrade (API) for upgrade-${service.upgradeService} @pre-upgrade @post-upgrade`,
      async ({ api }) => {
        await api.grafanaApi.waitForMetric(service.metric, `upgrade-${service.upgradeService}`);
      },
    );
  }
});
