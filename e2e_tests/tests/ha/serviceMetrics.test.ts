import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const monitoredServices = [
  {
    groupBy: 'pod',
    metric: 'ClickHouseAsyncMetrics_AsynchronousMetricsUpdateInterval',
    name: 'ClickHouse',
  },
  { groupBy: 'service_name', metric: 'pg_exporter_scrapes_total', name: 'PostgreSQL' },
  { groupBy: 'pod', metric: 'vm_vminsert_conns', name: 'VictoriaMetrics' },
  { groupBy: 'pod', metric: 'haproxy_backend_active_servers', name: 'HAProxy' },
];
const sourceCount = (metric: string, groupBy: string) => `count(count by (${groupBy}) (${metric}))`;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2108 - Verify service metrics are collected after a leader switchover @pmm-ha',
  async ({ api, haClusterHelper, k8sHelper }) => {
    const expectedSources = new Map<string, number | undefined>();

    for (const service of monitoredServices) {
      await pmmTest.step(`Baseline the ${service.name} sources reporting metrics`, async () => {
        await expect(async () => {
          const sources = await api.prometheusApi.instantQueryValue(
            sourceCount(service.metric, service.groupBy),
          );

          expect(
            sources,
            `${service.name} must report "${service.metric}" before the switchover`,
          ).toBeGreaterThan(0);

          expectedSources.set(service.metric, sources);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    }

    const switchoverAt = await pmmTest.step('Switch the leader to another node', async () => {
      const initialLeader = haClusterHelper.leaderFromPods();

      k8sHelper.deletePod(initialLeader).assertSuccess();
      await haClusterHelper.waitForLeaderChange(initialLeader, Timeouts.FIVE_MINUTES);

      await haClusterHelper.waitForApiServing(api.haApi);

      const serverTime = await api.prometheusApi.instantQueryValue('time()');

      if (serverTime === undefined) throw new Error('PMM returned no value for the PromQL time() function');

      return serverTime;
    });

    for (const service of monitoredServices) {
      await pmmTest.step(`Verify ${service.name} metrics are collected after the switchover`, async () => {
        await expect(async () => {
          expect(
            await api.prometheusApi.instantQueryValue(sourceCount(service.metric, service.groupBy)),
            `Every ${service.name} source reporting before the switchover must still report after it`,
          ).toEqual(expectedSources.get(service.metric));

          expect(
            await api.prometheusApi.instantQueryValue(`min(timestamp(${service.metric}))`),
            `Every ${service.name} source must be scraped again after the switchover`,
          ).toBeGreaterThan(switchoverAt);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    }
  },
);
