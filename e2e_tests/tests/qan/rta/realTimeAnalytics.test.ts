import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, page, realTimeAnalyticsPage }) => {
  await grafanaHelper.authorize();

  const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

  await page.goto(realTimeAnalyticsPage.getUrlWithServices([service.service_id]));
});

pmmTest(
  'PMM-T2169 - Verify Pause/Resume functionality for Real Time Analytics @rta',
  async ({ page, realTimeAnalyticsPage }) => {
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
