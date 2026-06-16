import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

let sortedHostNames: string[];

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const service1 = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
  const service2 = await api.inventoryApi.getServiceDetailsByPartialName('rs102');

  sortedHostNames = [service1.service_name, service2.service_name].sort();

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service1.service_id);
  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service2.service_id);
  await page.goto(queryAnalytics.rta.getUrlWithServices([service1.service_id, service2.service_id]));
});

pmmTest(
  'PMM-T2173 PMM-T2174 Verify that Real Time Analytics Overview queries are displayed @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    await queryAnalytics.rta.elements.realTimeTable.waitFor({ state: 'visible' });
    await queryAnalytics.rta.builders.operationIdForRow('1').waitFor({ state: 'visible' });

    await pmmTest.step('Simulate long running queries', async () => {
      mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.TWENTY_SECONDS,
        queryLabel: 'rta-1',
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the query to run for some time
      await page.waitForTimeout(Timeouts.THREE_SECONDS);

      mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.TWENTY_SECONDS,
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
      await expect(queryAnalytics.rta.buttons.stopAllSessions).toBeVisible();
      await expect(queryAnalytics.rta.buttons.openNewSessionModal).toBeVisible();
    });
  },
);

pmmTest(
  'PMM-T2184 Verify RTA overview sorting by query text @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    const queryLabels = ['rta-sort-alpha', 'rta-sort-bravo', 'rta-sort-charlie'];

    await pmmTest.step('Simulate long running queries', async () => {
      for (const queryLabel of queryLabels) {
        void mongoDbHelper.simulateLongRunningQuery({
          delayMs: Timeouts.TEN_SECONDS,
          queryLabel,
        });

        // eslint-disable-next-line playwright/no-wait-for-timeout -- stagger query start time for predictable rows
        await page.waitForTimeout(500);
      }

      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-sort')).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Pause RTA and filter sorting queries', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText('rta-sort');

      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-sort')).toHaveCount(3);
    });

    await pmmTest.step('Verify ascending sorting by query text', async () => {
      await queryAnalytics.rta.clickQueryTextHeader();

      await expect(queryAnalytics.rta.builders.queryByRowIndex('1')).toContainText('rta-sort-alpha');
      await expect(queryAnalytics.rta.builders.queryByRowIndex('2')).toContainText('rta-sort-bravo');
      await expect(queryAnalytics.rta.builders.queryByRowIndex('3')).toContainText('rta-sort-charlie');
    });

    await pmmTest.step('Verify descending sorting by query text', async () => {
      await queryAnalytics.rta.clickQueryTextHeader();

      await expect(queryAnalytics.rta.builders.queryByRowIndex('1')).toContainText('rta-sort-charlie');
      await expect(queryAnalytics.rta.builders.queryByRowIndex('2')).toContainText('rta-sort-bravo');
      await expect(queryAnalytics.rta.builders.queryByRowIndex('3')).toContainText('rta-sort-alpha');
    });
  },
);

pmmTest('PMM-T2185 Verify RTA overview sorting by Host @rta', async ({ queryAnalytics }) => {
  await pmmTest.step('Wait for queries from both services', async () => {
    await expect
      .poll(
        async () =>
          await queryAnalytics.rta.builders
            .rowByQueryText('hello')
            .filter({ hasText: sortedHostNames[0] })
            .count(),
        { timeout: Timeouts.TEN_SECONDS },
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () =>
          await queryAnalytics.rta.builders
            .rowByQueryText('hello')
            .filter({ hasText: sortedHostNames[1] })
            .count(),
        { timeout: Timeouts.TEN_SECONDS },
      )
      .toBeGreaterThan(0);
  });

  await pmmTest.step('Pause RTA and filter common queries', async () => {
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    await queryAnalytics.rta.filterQueriesByText('hello');
  });

  await pmmTest.step('Verify ascending sorting by Host', async () => {
    await queryAnalytics.rta.clickHostHeader();

    await expect(queryAnalytics.rta.builders.hostForRow('1')).toContainText(sortedHostNames[0]);
    await expect(queryAnalytics.rta.builders.hostForLastRow()).toContainText(sortedHostNames[1]);
  });

  await pmmTest.step('Verify descending sorting by Host', async () => {
    await queryAnalytics.rta.clickHostHeader();

    await expect(queryAnalytics.rta.builders.hostForRow('1')).toContainText(sortedHostNames[1]);
    await expect(queryAnalytics.rta.builders.hostForLastRow()).toContainText(sortedHostNames[0]);
  });
});
