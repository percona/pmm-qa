import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2195 Verify user is redirected to Sessions page when sessions are running @rta',
  async ({ api, helpPage, page, queryAnalytics, realTimeAnalyticsPage }) => {
    const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

    await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);

    await page.goto(queryAnalytics.rtaSessionsUrl);
    await expect(realTimeAnalyticsPage.buttons.stopAllSessions).toBeVisible();

    await pmmTest.step('Navigate to help page', async () => {
      await page.goto(helpPage.url);
      await helpPage.buttons.viewDocs.waitFor({ state: 'visible' });
    });

    await pmmTest.step('Navigate to selection page via url', async () => {
      await page.goto(queryAnalytics.rtaSelectionUrl);
    });

    await pmmTest.step('User is redirected to the Sessions page', async () => {
      await expect(page).toHaveURL(new RegExp(queryAnalytics.rtaSessionsUrl), {
        timeout: Timeouts.TEN_SECONDS,
      });
    });
  },
);
