import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import PrometheusApi from '@api/prometheus.api';
import { Timeouts } from '@helpers/timeouts';

const stateKey = 'MONGODB_CONNECTIONS';
const currentConnections = 'mongodb_connections{state="current"}';
const connectionsByService = async (
  prometheusApi: PrometheusApi,
  query: string,
): Promise<Record<string, number>> =>
  Object.fromEntries(
    (await prometheusApi.instantQuery(`max by (service_name) (${query})`)).map((sample) => [
      sample.metric.service_name,
      Number(sample.value[1]),
    ]),
  );
// Steady state drifts by a few connections per node; a leak keeps growing past this.
const allowedConnections = (before: number) => before + Math.ceil(before * 0.1);

pmmTest.describe('MongoDB connections after upgrade', () => {
  pmmTest(
    'Save MongoDB connections before upgrade @mongodb-connections-baseline',
    async ({ api, testState }) => {
      const before = await connectionsByService(
        api.prometheusApi,
        `max_over_time(${currentConnections}[5m])`,
      );

      expect(
        Object.keys(before).length,
        'MongoDB connections must be reported before the upgrade',
      ).toBeGreaterThan(0);

      testState.save({ [stateKey]: JSON.stringify(before) });
    },
  );

  pmmTest(
    'Verify MongoDB connections do not increase after upgrade @mongodb-connections-check',
    async ({ api, testState }) => {
      const before = JSON.parse(testState.get(stateKey)) as Record<string, number>;

      await expect(async () => {
        const after = await connectionsByService(api.prometheusApi, currentConnections);

        console.log(Object.entries(before));
        console.log(after);
        console.log(
          Object.entries(before).map(
            ([service, count]) => `${service}: ${count} -> ${after[service]}  (${allowedConnections(count)})`,
          ),
        );

        const increased = Object.entries(before)
          .filter(([service, count]) => (after[service] ?? 0) > allowedConnections(count))
          .map(([service, count]) => `${service}: ${count} -> ${after[service]}`);

        expect(
          Object.keys(after).length,
          'MongoDB connections must be reported after the upgrade',
        ).toBeGreaterThan(0);
        expect(increased, 'MongoDB connections increased after the upgrade').toEqual([]);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    },
  );
});
