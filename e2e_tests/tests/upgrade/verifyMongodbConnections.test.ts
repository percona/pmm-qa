import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const stateKey = 'MONGODB_CONNECTIONS';
const currentConnections = 'mongodb_connections{state="current"}';
// Steady state drifts by a few connections per node; a leak keeps growing past this.
const allowedConnections = (before: number) => before + Math.ceil(before * 0.1);

// The file name sorts last among upgrade tests: with one worker Playwright runs files alphabetically,
// so the baseline and the check see the services every other upgrade test adds.
pmmTest.describe('MongoDB connections after upgrade', () => {
  pmmTest('Save MongoDB connections before upgrade @pre-upgrade', async ({ api, testState }) => {
    const before = await api.prometheusApi.getHighestValuePerService(
      `max_over_time(${currentConnections}[5m])`,
    );

    expect(
      Object.keys(before).length,
      'MongoDB connections must be reported before the upgrade',
    ).toBeGreaterThan(0);

    testState.save({ [stateKey]: JSON.stringify(before) });
  });

  pmmTest(
    'Verify MongoDB connections do not increase after upgrade @post-server-upgrade @post-upgrade',
    async ({ api, testState }) => {
      const before = JSON.parse(testState.get(stateKey)) as Record<string, number>;

      await expect(async () => {
        const after = await api.prometheusApi.getHighestValuePerService(currentConnections);

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
