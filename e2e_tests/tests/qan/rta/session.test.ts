import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2181 Verify redirect to selection page when no session exists @rta',
  async ({ page, queryAnalytics, realTimeAnalyticsPage }) => {
    await pmmTest.step('Ensure no active session exists', async () => {
      await page.goto(queryAnalytics.rtaSessionsUrl);
      await expect(page).toHaveURL(
        new RegExp(`${queryAnalytics.rtaSessionsUrl}|${queryAnalytics.rtaSelectionUrl}`),
      );

      if (page.url().includes(queryAnalytics.rtaSessionsUrl)) {
        await realTimeAnalyticsPage.stopAllSessions();
      }
    });

    await pmmTest.step('Navigate directly to /rta/overview', async () => {
      await page.goto(queryAnalytics.rta.url);
    });

    await pmmTest.step('User is directed to selection page', async () => {
      await expect(page).toHaveURL(queryAnalytics.rtaSelectionUrl, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(queryAnalytics.buttons.startSessionButton).toBeVisible();
    });
  },
);

pmmTest('PMM-T2182 Verify overview loads when session exists @rta', async ({ api, page, queryAnalytics }) => {
  const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
  const serviceId = service.service_id;

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(serviceId);

  await pmmTest.step('Navigate directly to overview', async () => {
    await page.goto(queryAnalytics.rta.url);
  });

  await pmmTest.step('Overview page loads', async () => {
    await expect(queryAnalytics.rta.elements.realTimeTable).toBeVisible();
  });

  await pmmTest.step('Cluster/Service input is visible and functional', async () => {
    await expect(queryAnalytics.rta.inputs.clusterService).toBeVisible();
    await queryAnalytics.rta.inputs.clusterService.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
