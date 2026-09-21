import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM settings tests for upgrade', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest('Verify user is able to set custom Settings @pre-upgrade', async ({ api }) => {
    const body = {
      data_retention: '172800s',
      metrics_resolutions: {
        hr: '30s',
        lr: '60s',
        mr: '60s',
      },
      telemetry_enabled: true,
    };
    const response = await api.settingsApi.changeSettings(body);

    expect(response).toBeTruthy();

    await api.serverApi.waitForReady();
  });
});
