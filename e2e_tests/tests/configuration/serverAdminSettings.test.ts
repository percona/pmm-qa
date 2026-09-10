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
    await expect(serverAdminSettingsPage.elements.databaseType).toHaveText('postgres', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-10162 Verify that Grafana Enterprise is not present @settings @grafana-pr',
  async ({ page, statsAndLicensePage }) => {
    await page.goto(statsAndLicensePage.url);
    await statsAndLicensePage.waitForPageLoaded();
    await expect(statsAndLicensePage.elements.manageDashboardsLabel).toBeVisible();

    await pmmTest.step('Verify no Grafana Enterprise advertising is present', async () => {
      for (const text of statsAndLicensePage.enterpriseAdvertising) {
        await expect(statsAndLicensePage.builders.advertisement(text)).toHaveCount(0);
      }
    });
  },
);
