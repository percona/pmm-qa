import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1110 - Verify Grafana using Postgres database @settings',
  async ({ page, serverAdminSettingsPage }) => {
    await page.goto(serverAdminSettingsPage.url);
    await expect(serverAdminSettingsPage.elements.settingsTitle).toBeVisible({
      timeout: Timeouts.ONE_MINUTE,
    });

    await pmmTest.step('Verify Grafana reports postgres as its database type', async () => {
      await expect(serverAdminSettingsPage.elements.databaseType).toHaveText('postgres', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });
  },
);
