import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const stateKey = 'MONGODB_CONNECTIONS';
const currentConnections = 'mongodb_connections{state="current"}';

pmmTest.describe('MongoDB connections tests', () => {
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
});
