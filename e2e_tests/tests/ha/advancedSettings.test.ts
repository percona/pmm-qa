import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2217 Verify HA mode shows detailed error when enabling QAN for PMM Server @pmm-ha',
  async ({ page, settingsPage }) => {
    await pmmTest.step('Verify detailed HA error is shown in UI', async () => {
      await page.goto(settingsPage.urls.advanced);
      await expect(settingsPage.elements.pageTitle).toBeVisible();

      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes(apiEndpoints.server.settings) && response.request().method() === 'PUT',
        ),
        settingsPage.enableToggleAndApplyChanges('qanForPmmServer'),
      ]);

      expect(response.status()).toEqual(400);

      const responseBody = (await response.json()) as { message: string };

      expect(responseBody.message).toEqual(settingsPage.haQanErrorMessage);
      await expect(settingsPage.elements.pageBody).toContainText(settingsPage.haQanErrorMessage);
    });
  },
);
