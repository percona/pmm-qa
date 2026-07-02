import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2300 Verify GUI upgrade trigger is removed @settings',
  async ({ page, updatesPage }) => {
    await pmmTest.step('Updates page has no Upgrade Now button', async () => {
      await updatesPage.open();
      await expect(updatesPage.elements.updateNow).toHaveCount(0);
    });

    await pmmTest.step('Clients status page has no Upgrade Now button', async () => {
      await page.goto(updatesPage.clientsUrl);
      await expect(updatesPage.elements.pageTitle).toBeVisible();
      await expect(updatesPage.elements.updateNow).toHaveCount(0);
    });
  },
);

pmmTest(
  'PMM-T2301 Verify upgrade trigger API endpoints are removed @settings',
  async ({ page }) => {
    const headers = {
      Authorization: `Basic ${GrafanaHelper.getToken()}`,
      'Content-Type': 'application/json',
    };

    await pmmTest.step('POST /v1/server/updates:start returns 404', async () => {
      const response = await page.request.post(apiEndpoints.server.updatesStart, {
        data: {},
        headers,
      });

      expect(response.status()).toBe(404);
    });

    await pmmTest.step('POST /v1/server/updates:getStatus returns 404', async () => {
      const response = await page.request.post(apiEndpoints.server.updatesStatus, {
        data: {},
        headers,
      });

      expect(response.status()).toBe(404);
    });
  },
);

pmmTest(
  'PMM-T2302 Verify update notifications setting remains in Advanced settings @settings',
  async ({ page, updatesPage }) => {
    await pmmTest.step('Advanced settings shows Check for updates toggle', async () => {
      await page.goto(updatesPage.advancedSettingsUrl);
      await expect(updatesPage.elements.checkForUpdates).toBeVisible();
      await expect(page.getByText(/watchtower/i)).toHaveCount(0);
    });
  },
);
