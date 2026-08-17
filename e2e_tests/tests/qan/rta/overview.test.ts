import { readFile } from 'node:fs/promises';
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

pmmTest('PMM-T2252 Verify RTA overview CSV export @rta', async ({ page, queryAnalytics }, testInfo) => {
  await pmmTest.step('Verify export is hidden while real-time updates are running', async () => {
    await expect(queryAnalytics.rta.buttons.pauseRealTimeAnalytics).toBeVisible();
    await expect(queryAnalytics.rta.buttons.export).toBeHidden();
  });

  await pmmTest.step('Pause RTA, filter rows, and sort by host', async () => {
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    await expect(queryAnalytics.rta.buttons.export).toBeVisible();
    await queryAnalytics.rta.filterQueriesByText('db.runCommand');
    await queryAnalytics.rta.clickHostHeader();
    await expect(queryAnalytics.rta.elements.realTimeTableRow.first()).toBeVisible();
  });

  await pmmTest.step('Export CSV and verify it matches the paginated table order', async () => {
    const nextPageButton = queryAnalytics.rta.buttons.nextPage;
    const uiOperationIds: string[] = [];

    while (true) {
      const rowsCount = await queryAnalytics.rta.elements.realTimeTableRow.count();

      for (let index = 1; index <= rowsCount; index++) {
        uiOperationIds.push(await queryAnalytics.rta.getOperationIdByRow(String(index)));
      }

      if (await nextPageButton.isDisabled()) {
        break;
      }

      await nextPageButton.click();
    }

    const downloadPromise = page.waitForEvent('download');

    await queryAnalytics.rta.buttons.export.click();

    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    const csvPath = testInfo.outputPath(fileName);

    expect(fileName).toMatch(/^mongodb_rta_export_\d{8}_\d{6}\.csv$/);

    await download.saveAs(csvPath);

    const csvContent = await readFile(csvPath, 'utf8');
    const csvOperationIds = Array.from(csvContent.matchAll(/^"(\d+)",/gm), (match) => match[1]);

    expect(csvContent).toContain('operation_id');
    expect(csvContent).toContain('elapsed_exec_time_sec');
    expect(csvContent).toContain('plan_summary');
    expect(csvContent).toContain('raw_query');
    expect(csvOperationIds).toHaveLength(uiOperationIds.length);
    expect(csvOperationIds).toEqual(uiOperationIds);
  });
});

pmmTest(
  'PMM-T2265 Verify RTA overview table state is stored in the URL and restored after refresh @rta',
  { annotation: { type: 'min-pmm-version', description: '3.10.0' } },
  async ({ page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const expectedServiceIds = new URL(page.url()).searchParams.getAll('serviceIds');

    await pmmTest.step('Set up table state', async () => {
      expect(expectedServiceIds).toHaveLength(2);
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.filterQueriesByText('db.runCommand');
      await rta.inputs.rowsLimit.click();
      await rta.builders.rowsPerPageOption('10').click();
      await rta.clickElapsedTimeHeader();
    });

    await pmmTest.step('Verify table state in the URL', async () => {
      await expect
        .poll(() => new URL(page.url()).searchParams.get('overview.f.queryText'))
        .toBe('db.runCommand');
      await expect.poll(() => new URL(page.url()).searchParams.get('overview.pageSize')).toBe('10');
      await expect.poll(() => new URL(page.url()).searchParams.get('overview.sort')).not.toBeNull();
      expect(new URL(page.url()).searchParams.getAll('serviceIds')).toEqual(expectedServiceIds);
    });

    await pmmTest.step('Reload the page', async () => {
      await page.reload();
      await rta.elements.realTimeTable.waitFor({ state: 'visible' });
      await rta.openFiltersIfHidden();
    });

    await pmmTest.step('Verify restored table state', async () => {
      await expect(rta.inputs.filterByQueryText).toHaveValue('db.runCommand');
      await expect(rta.inputs.rowsLimit).toHaveText('10');
      await expect(rta.elements.elapsedTimeColumnHeader).toHaveAccessibleName(
        /Elapsed time Sorted by Elapsed time descending/,
      );
      expect(new URL(page.url()).searchParams.getAll('serviceIds')).toEqual(expectedServiceIds);
    });
  },
);

pmmTest(
  'PMM-T2266 Verify RTA elapsed-time decimal filter and URL restoration @rta',
  { annotation: { type: 'min-pmm-version', description: '3.10.0' } },
  async ({ page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const durationParameterName = 'overview.f.queryExecutionDurationMs';
    let decimalMaximum = '';
    let decimalMinimum = '';
    let rowsBeforeFilter = 0;

    await pmmTest.step('Set up decimal duration filters', async () => {
      await rta.elements.realTimeTableRow.first().waitFor({ state: 'visible' });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.openFilters();

      const rowCount = await rta.elements.realTimeTableRow.count();
      const durations = (await rta.elements.durationCells.allTextContents()).map(Number.parseFloat);
      const shortestDuration = Math.min(...durations);
      const longestDuration = Math.max(...durations);

      rowsBeforeFilter = rowCount;
      decimalMinimum = String(Number(((shortestDuration + longestDuration) / 2).toFixed(2)));
      decimalMaximum = String(longestDuration);

      expect(longestDuration).toBeGreaterThan(shortestDuration);
      await rta.inputs.minimumDuration.fill(decimalMinimum);
      await rta.inputs.maximumDuration.fill(decimalMaximum);
    });

    await pmmTest.step('Verify filtered results', async () => {
      await expect
        .poll(async () => {
          const values = await rta.elements.durationCells.allTextContents();

          return (
            values.length > 0 &&
            values.length < rowsBeforeFilter &&
            values.every(
              (value) =>
                Number.parseFloat(value) >= Number(decimalMinimum) &&
                Number.parseFloat(value) <= Number(decimalMaximum),
            )
          );
        })
        .toBeTruthy();
    });

    const durationParameterValue = await pmmTest.step('Verify duration filters in the URL', async () => {
      await expect
        .poll(() => new URL(page.url()).searchParams.get(durationParameterName))
        .toEqual(expect.stringContaining(decimalMinimum));
      await expect
        .poll(() => new URL(page.url()).searchParams.get(durationParameterName))
        .toEqual(expect.stringContaining(decimalMaximum));

      return new URL(page.url()).searchParams.get(durationParameterName);
    });

    await pmmTest.step('Reload and verify restored duration filters', async () => {
      await page.reload();
      await rta.openFiltersIfHidden();

      await expect(rta.inputs.minimumDuration).toHaveValue(decimalMinimum);
      await expect(rta.inputs.maximumDuration).toHaveValue(decimalMaximum);
      expect(new URL(page.url()).searchParams.get(durationParameterName)).toBe(durationParameterValue);
    });
  },
);
