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
  });

  pmmTest('Verify PMM Settings are retained after upgrade @post-upgrade', async ({ page, settingsPage }) => {
    await page.goto(settingsPage.urls.advanced);
    await expect(settingsPage.inputs.dataRetention).toHaveValue('2');
    await page.goto(settingsPage.urls.metrics);
    await expect(settingsPage.inputs.low).toHaveValue('60');
    await expect(settingsPage.inputs.medium).toHaveValue('60');
    await expect(settingsPage.inputs.high).toHaveValue('30');
  });
});
