import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import { services } from '../../testdata/externalServices';

pmmTest.describe('PMM upgrade tests for external services', () => {
  const redisServiceName = 'pmm-ui-tests-redis-external-remote';

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
    // eslint-disable-next-line playwright/expect-expect -- Pre upgrade test
    pmmTest(
      `PMM-T2074 - Verify user can create Remote Instance ${service.serviceType} before upgrade @pre-upgrade`,
      async ({ api }) => {
        const remoteInstance = api.remoteInstanceApi.buildRemoteInstanceDataBody(service);

        await api.remoteInstanceApi.addRemoteInstance(remoteInstance);
      },
    );
  }

  pmmTest(
    'Verify Redis as external Service Works After Upgrade @post-upgrade @post-client-upgrade',
    async ({ api }) => {
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
    },
  );

  for (const service of services) {
    pmmTest(
      `PMM-T2073 - Verify Agents are RUNNING after Upgrade (API) for ${service.serviceType} @post-upgrade @post-client-upgrade`,
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
      `PMM-T2071 - Verify Agents are Running and Metrics are being collected Pre and Post Upgrade (API) for upgrade-${service.upgradeService} @pre-upgrade @post-upgrade @post-client-upgrade`,
      async ({ api }) => {
        await api.grafanaApi.waitForMetric(service.metric, `upgrade-${service.upgradeService}`);
      },
    );
  }
});
