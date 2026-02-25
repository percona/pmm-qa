import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api }) => {
  await api.realTimeAnalyticsApi.stopAllSessions();
});

const viewports = [
  { height: 1_080, name: 'Horizontal monitor', width: 1_920 },
  { height: 1_920, name: 'Vertical monitor', width: 1_080 },
];

for (const viewport of viewports) {
  pmmTest(
    `PMM-T14588 - Verify selection page elements and functionality on ${viewport.name} @rta`,
    async ({ page, realTimeAnalyticsPage }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await page.goto(realTimeAnalyticsPage.url);
      await realTimeAnalyticsPage.navigateToRealTimeTab();
      await realTimeAnalyticsPage.verifySelectionPageUI();
      await realTimeAnalyticsPage.verifyStartButtonDisabled();
      await realTimeAnalyticsPage.selectFirstService();
      await realTimeAnalyticsPage.verifyStartButtonEnabled();
    },
  );
}

pmmTest(
  'PMM-T14588 - Verify all services appear in dropdown and search works @rta',
  async ({ api, page, realTimeAnalyticsPage }) => {
    const services = await api.inventoryApi.getServices();
    const mongoServices = services.services
      .filter((s) => s.service_type === 'mongodb')
      .map((s) => s.service_name);

    await page.goto(realTimeAnalyticsPage.url);
    await realTimeAnalyticsPage.searchService('');
    await realTimeAnalyticsPage.verifyDropdownOptions(mongoServices);

    const searchString = mongoServices[0];

    await realTimeAnalyticsPage.searchService(searchString);
    await realTimeAnalyticsPage.verifySingleDropdownOption(searchString);
  },
);

pmmTest(
  'PMM-T14588 - Verify session start and redirect @rta',
  async ({ api, page, queryAnalytics, realTimeAnalyticsPage }) => {
    const services = await api.inventoryApi.getServices();
    const service = services.services.find((s) => s.service_type === 'mongodb');

    if (!service) {
      throw new Error('No MongoDB service found');
    }

    await page.goto(queryAnalytics.url);
    await realTimeAnalyticsPage.navigateToRealTimeTab();
    await realTimeAnalyticsPage.selectService(service.service_name);
    await realTimeAnalyticsPage.startRealTimeSession();
    await realTimeAnalyticsPage.verifyRedirectToOverview(service.service_id);
  },
);

pmmTest(
  'PMM-T2169 - Verify Pause/Resume functionality for Real Time Analytics @rta',
  async ({ api, page, realTimeAnalyticsPage }) => {
    const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

    await page.goto(realTimeAnalyticsPage.getUrlWithServices([service.service_id]));

    let calls: { method: string; requestTime: Date; url: string }[] = [];

    await realTimeAnalyticsPage.buttons.pauseRealTimeAnalytics.click();

    const operationId =
      (await realTimeAnalyticsPage.builders.operationIdForRow('1').first().textContent()) || '';

    page.on('request', (request) => {
      if (request.url().includes('v1/realtimeanalytics/queries:search')) {
        calls.push({
          method: request.method(),
          requestTime: new Date(),
          url: request.url(),
        });
      }
    });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- Needs to wait ten seconds to confirm that no BE call is being made.
    await page.waitForTimeout(Timeouts.TEN_SECONDS);
    expect
      .soft(
        calls,
        `Numbers of BE calls to RTA endpoint is expected to be 0 when RTA is paused but is: ${calls.length}`,
      )
      .toHaveLength(0);

    await expect(
      realTimeAnalyticsPage.builders.operationIdForRow('1').first(),
      `Operation ID of the newest query should not change when RTA is paused`,
    ).toHaveText(operationId);

    calls = [];
    await realTimeAnalyticsPage.buttons.resumeRealTimeAnalytics.click();
    await expect
      .poll(() => calls.length, {
        message: `Numbers of BE calls to RTA endpoint is expected to be 5 due to 2 seconds default interval but count of calls is: ${calls.length}`,
        timeout: Timeouts.TEN_SECONDS,
      })
      .toEqual(5);
    await expect(
      realTimeAnalyticsPage.builders.operationIdForRow('1').first(),
      `Operation ID of the newest query should change when RTA is resumed`,
    ).not.toHaveText(operationId);
  },
);
