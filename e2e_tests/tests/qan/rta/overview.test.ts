import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  await page.goto(queryAnalytics.rta.getUrlWithServices([service.service_id]));
});

pmmTest(
  'PMM-T2173 PMM-T2174 Verify that Real Time Analytics Overview queries are displayed @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    await queryAnalytics.rta.elements.realTimeTable.waitFor({ state: 'visible' });
    await queryAnalytics.rta.builders.operationIdForRow('1').waitFor({ state: 'visible' });

    await pmmTest.step('Simulate long running queries', async () => {
      mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.ONE_MINUTE,
        queryLabel: 'rta-1',
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the query to run for some time
      await page.waitForTimeout(3_000);

      mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.ONE_MINUTE,
        queryLabel: 'rta-2',
      });
    });

    await pmmTest.step('PMM-T2174 Filter by query text and verify 2 queries are visible', async () => {
      await queryAnalytics.rta.filterQueriesByText('rta');
      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-1')).toBeVisible();
      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-2')).toBeVisible();
    });

    await pmmTest.step('Pause RTA', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    });

    await pmmTest.step('PMM-T2173 Verify elapsed time for queries is descending by default', async () => {
      const elapedTimeForQuery1 = await queryAnalytics.rta.getElapsedTimeForQueryByText('rta-1');
      const elapedTimeForQuery2 = await queryAnalytics.rta.getElapsedTimeForQueryByText('rta-2');

      expect(elapedTimeForQuery1).toBeGreaterThan(0);
      expect(elapedTimeForQuery2).toBeGreaterThan(0);
      expect(elapedTimeForQuery1).toBeGreaterThan(elapedTimeForQuery2);
    });

    await pmmTest.step('PMM-T2173 Verify descending sorting by elapsed time', async () => {
      await queryAnalytics.rta.clickElapsedTimeHeader();

      const elapedTimeForQuery1 = await queryAnalytics.rta.getElapsedTimeForQueryByRow('1');
      const elapedTimeForQuery2 = await queryAnalytics.rta.getElapsedTimeForQueryByRow('2');

      expect(elapedTimeForQuery1).toBeGreaterThan(elapedTimeForQuery2);
    });

    await pmmTest.step('PMM-T2173 Verify ascending sorting by elapsed time', async () => {
      await queryAnalytics.rta.clickElapsedTimeHeader();

      const elapedTimeForQuery1 = await queryAnalytics.rta.getElapsedTimeForQueryByRow('1');
      const elapedTimeForQuery2 = await queryAnalytics.rta.getElapsedTimeForQueryByRow('2');

      expect(elapedTimeForQuery2).toBeGreaterThan(elapedTimeForQuery1);
    });
  },
);

pmmTest(
  'PMM-T2175 - Verify all sessions button opens sessions list page @rta',
  async ({ queryAnalytics }) => {
    await queryAnalytics.rta.elements.realTimeTable.waitFor({ state: 'visible' });

    await pmmTest.step('Click all sessions button', async () => {
      await queryAnalytics.rta.buttons.allSessions.click();
    });

    await pmmTest.step('Verify sessions list page is opened', async () => {
      await expect(queryAnalytics.rta.elements.realTimeTable).toBeHidden();
      await expect(queryAnalytics.rta.buttons.openStopAllModal).toBeVisible();
      await expect(queryAnalytics.rta.buttons.openNewSessionModal).toBeVisible();
    });
  },
);
