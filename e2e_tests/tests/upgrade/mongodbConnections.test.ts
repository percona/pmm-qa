import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import PrometheusApi from '@api/prometheus.api';
import { Timeouts } from '@helpers/timeouts';

const currentConnections = 'mongodb_connections{state="current"}';
const connectionsByService = async (prometheusApi: PrometheusApi, query: string) =>
  new Map(
    (await prometheusApi.instantQuery(`max by (service_name) (${query})`)).map((sample) => [
      sample.metric.service_name,
      Number(sample.value[1]),
    ]),
  );
// Steady state drifts by a few connections per node; a leak keeps growing past this.
const allowedConnections = (before: number) => before + Math.max(10, Math.ceil(before * 0.2));

pmmTest.describe('MongoDB connections after upgrade', () => {
  pmmTest(
    'Verify MongoDB connections do not increase after upgrade @post-server-upgrade @post-upgrade',
    async ({ api }) => {
      // VictoriaMetrics restarts with the upgraded server container, and its volume keeps the pre-upgrade samples.
      const serverStartedAt = await api.prometheusApi.instantQueryValue(
        'vm_app_start_timestamp{job="victoriametrics"}',
      );

      if (serverStartedAt === undefined) {
        throw new Error('VictoriaMetrics did not report its start time');
      }

      const before = await connectionsByService(
        api.prometheusApi,
        `max_over_time(${currentConnections}[15m] @ ${serverStartedAt - 60})`,
      );

      expect(
        before.size,
        'MongoDB connections must be recorded before the PMM Server upgrade',
      ).toBeGreaterThan(0);

      await expect(async () => {
        const after = await connectionsByService(api.prometheusApi, currentConnections);
        const increased = [...before]
          .filter(([service, count]) => (after.get(service) ?? 0) > allowedConnections(count))
          .map(([service, count]) => `${service}: ${count} -> ${after.get(service)}`);

        expect(after.size, 'MongoDB connections must be reported after the upgrade').toBeGreaterThan(0);
        expect(increased, 'MongoDB connections increased after the upgrade').toEqual([]);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    },
  );
});
