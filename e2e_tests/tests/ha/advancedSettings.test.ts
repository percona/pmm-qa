import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

// TODO: Reenable this test after HA workflow is created
// eslint-disable-next-line playwright/no-skipped-test -- PMM-T2217 is intentionally skipped for the HA scenario.
pmmTest.skip(
  'PMM-T2217 Verify HA mode shows detailed error when enabling QAN for PMM Server @settings',
  async ({ advancedSettingsPage, page, request }) => {
    await pmmTest.step('Verify HA mode is enabled', async () => {
      await advancedSettingsPage.haEnableCheck(request);
    });

    await pmmTest.step('Verify detailed HA error is shown in UI', async () => {
      await page.goto(advancedSettingsPage.url);
      await expect(advancedSettingsPage.elements.pageTitle).toBeVisible();

      const updateSettingsResponse = page.waitForResponse(
        (response) =>
          response.url().includes(apiEndpoints.server.settings) && response.request().method() === 'PUT',
      );

      await advancedSettingsPage.enableToggleAndApplyChanges('qanForPmmServer');

      const response = await updateSettingsResponse;

      expect(response.status()).toEqual(400);

      const responseBody = (await response.json()) as { message: string };

      expect(responseBody.message).toEqual(advancedSettingsPage.haQanErrorMessage);
      await expect(page.frameLocator('#grafana-iframe').locator('body')).toContainText(
        advancedSettingsPage.haQanErrorMessage,
      );
    });
  },
);
