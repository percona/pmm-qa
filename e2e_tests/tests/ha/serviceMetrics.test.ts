import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const monitoredServices = [
  {
    expectedSources: 6,
    groupBy: 'pod',
    metric: 'ClickHouseAsyncMetrics_AsynchronousMetricsUpdateInterval',
    name: 'ClickHouse',
  },
  { expectedSources: 3, groupBy: 'service_name', metric: 'pg_exporter_scrapes_total', name: 'PostgreSQL' },
  { expectedSources: 3, groupBy: 'pod', metric: 'vm_vminsert_conns', name: 'VictoriaMetrics' },
  { expectedSources: 3, groupBy: 'pod', metric: 'haproxy_backend_active_servers', name: 'HAProxy' },
];
const sourceCount = (metric: string, groupBy: string) => `count(count by (${groupBy}) (${metric}))`;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2108 - Verify service metrics are collected after a leader switchover @pmm-ha',
  async ({ api, haClusterHelper }) => {
    for (const service of monitoredServices) {
      await pmmTest.step(
        `Verify "${service.metric}" is reported by all ${service.expectedSources} ${service.name} sources`,
        async () => {
          await expect(async () => {
            expect(
              await api.prometheusApi.instantQueryValue(sourceCount(service.metric, service.groupBy)),
            ).toEqual(service.expectedSources);
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
        },
      );
    }

    const switchoverAt = await pmmTest.step('Switch the leader to another node', async () => {
      await haClusterHelper.failoverLeader(api.haApi);

      return await api.prometheusApi.waitForServerTime();
    });

    for (const service of monitoredServices) {
      await pmmTest.step(`Verify ${service.name} metrics are collected after the switchover`, async () => {
        await expect(async () => {
          expect(
            await api.prometheusApi.instantQueryValue(sourceCount(service.metric, service.groupBy)),
          ).toEqual(service.expectedSources);

          expect(
            await api.prometheusApi.instantQueryValue(`min(timestamp(${service.metric}))`),
          ).toBeGreaterThan(switchoverAt);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    }
  },
);
