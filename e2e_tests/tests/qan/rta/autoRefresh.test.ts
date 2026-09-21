import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, page, realTimeAnalyticsPage }) => {
  await grafanaHelper.authorize();

  const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  await page.goto(realTimeAnalyticsPage.getUrlWithServices([service.service_id]));
});

pmmTest(
  'PMM-T2166 Verify auto refresh dropdown, default value &interval behavior @rta',
  async ({ page, realTimeAnalyticsPage }) => {
    await pmmTest.step('Verify auto-refresh dropdown is visible and default is 2s', async () => {
      await expect(realTimeAnalyticsPage.buttons.refreshIntervalDropdown).toContainText('2s');
    });

    await pmmTest.step('Verify auto-refresh has the required interval options', async () => {
      await realTimeAnalyticsPage.buttons.refreshIntervalDropdown.click();

      for (const interval of realTimeAnalyticsPage.refreshIntervals) {
        await expect(page.getByRole('menuitem', { name: interval })).toBeVisible();
      }

      await page.keyboard.press('Escape');
    });

    await pmmTest.step('Verify default 2s interval', async () => {
      const isTwoSecondInterval = await realTimeAnalyticsPage.verifyRequestInterval(
        Timeouts.TWO_SECONDS,
        Timeouts.TEN_SECONDS,
      );

      expect(isTwoSecondInterval).toBeTruthy();
    });
  },
);

pmmTest('PMM-T2170 verify query refresh interval every 4s @rta', async ({ page, realTimeAnalyticsPage }) => {
  await realTimeAnalyticsPage.buttons.refreshIntervalDropdown.click();
  await page.getByRole('menuitem', { name: '4s' }).click();
  await expect(realTimeAnalyticsPage.buttons.refreshIntervalDropdown).toContainText('4s');

  const isFourSecondInterval = await realTimeAnalyticsPage.verifyRequestInterval(
    Timeouts.FOUR_SECONDS,
    Timeouts.FIFTEEN_SECONDS,
  );

  expect(isFourSecondInterval).toBeTruthy();
});
