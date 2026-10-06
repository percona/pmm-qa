import { readFile } from 'node:fs/promises';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

let sortedHostNames: string[];

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const service1 = await api.inventoryApi.getServiceDetailsByRegex('^rs101_');
  const service2 = await api.inventoryApi.getServiceDetailsByRegex('^rs102_');

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
        queryLabel: 'rta-overview-1',
      });

      // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the query to run for some time
      await page.waitForTimeout(Timeouts.THREE_SECONDS);

      mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.TWENTY_SECONDS,
        queryLabel: 'rta-overview-2',
      });
    });

    await pmmTest.step('PMM-T2174 Filter by query text and verify 2 queries are visible', async () => {
      // The filter is a case-insensitive substring match, and the base64 $clusterTime signature of a
      // running hello command can contain 'rta' ("z6YIJqRtajW..."); '-' is outside the base64 alphabet.
      await queryAnalytics.rta.filterQueriesByText('rta-overview-');
      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-overview-1')).toBeVisible();
      await expect(queryAnalytics.rta.builders.rowByQueryText('rta-overview-2')).toBeVisible();
    });

    await pmmTest.step('Pause RTA', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    });

    await pmmTest.step('PMM-T2173 Verify elapsed time for queries is descending by default', async () => {
      const elapedTimeForQuery1 = await queryAnalytics.rta.getElapsedTimeForQueryByText('rta-overview-1');
      const elapedTimeForQuery2 = await queryAnalytics.rta.getElapsedTimeForQueryByText('rta-overview-2');

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

  await pmmTest.step('Filter by Host and verify only matching rows remain', async () => {
    const rs101HostName = sortedHostNames.find((hostName) => hostName.startsWith('rs101')) as string;
    const rs102HostName = sortedHostNames.find((hostName) => hostName.startsWith('rs102')) as string;

    // The Host column uses a fuzzy filter, so a shared substring such as the
    // rsXXX prefix also matches the other host (rs102 is a subsequence of
    // rs101_23853 via the trailing port). Filter on the full host name, which
    // fuzzy-matches only its own rows.
    await queryAnalytics.rta.openFiltersIfHidden();
    await queryAnalytics.rta.inputs.filterByHost.fill(rs101HostName);
    await expect(queryAnalytics.rta.builders.rowByQueryText(rs102HostName)).toHaveCount(0);
    await expect(queryAnalytics.rta.builders.rowByQueryText(rs101HostName).first()).toBeVisible();
    await queryAnalytics.rta.openFiltersIfHidden();
    await queryAnalytics.rta.inputs.filterByHost.fill(rs102HostName);
    await expect(queryAnalytics.rta.builders.rowByQueryText(rs101HostName)).toHaveCount(0);
    await expect(queryAnalytics.rta.builders.rowByQueryText(rs102HostName).first()).toBeVisible();
  });
});

pmmTest('PMM-T2252 Verify RTA overview CSV export @rta', async ({ page, queryAnalytics }, testInfo) => {
  const dynamicHeader = 'future_export_field';
  const dynamicValue = 'future-export-value';

  await page.route(`**${queryAnalytics.rta.apiEndpoint}`, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { queries?: Record<string, unknown>[] };

    for (const query of body.queries ?? []) {
      query[dynamicHeader] = dynamicValue;
    }

    await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', response });
  });
  await page.reload();

  await pmmTest.step('Verify export is hidden while real-time updates are running', async () => {
    await expect(queryAnalytics.rta.buttons.pauseRealTimeAnalytics).toBeVisible();
    await expect(queryAnalytics.rta.buttons.export).toBeHidden();
  });

  await pmmTest.step('Filter rows, pause RTA, and sort by host', async () => {
    await queryAnalytics.rta.filterQueriesByText('db.runCommand');
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    await expect(queryAnalytics.rta.buttons.export).toBeVisible();
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
    const headerRow = csvContent.split('\n')[0];
    const headers = Array.from(headerRow.matchAll(/"([^"]*)"/g), (match) => match[1]);

    expect(csvOperationIds).toHaveLength(uiOperationIds.length);
    expect(csvOperationIds).toEqual(uiOperationIds);

    // client_app_name is dropped when empty (proto3 omits empty scalars), so
    // it is not required. service_id, query_text and the injected
    // future_export_field are unlisted API fields the dynamic export appends.
    const requiredHeaders = [
      'operation_id',
      'elapsed_exec_time_sec',
      'db_instance_address',
      'client_address',
      'database_name',
      'service',
      'user_name',
      'collection',
      'operation',
      'plan_summary',
      'operation_start_time',
      'data_capture_time',
      'raw_query',
      'service_id',
      'query_text',
      dynamicHeader,
    ];

    expect(headers).toEqual(expect.arrayContaining(requiredHeaders));
    expect(headers.every((header) => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(header))).toBe(true);
    expect(headers).not.toContain('query_execution_duration');
    expect(csvContent).toContain(dynamicValue);
  });

  await page.unroute(`**${queryAnalytics.rta.apiEndpoint}`);

  await pmmTest.step('Verify export is disabled when no rows match the filter', async () => {
    await queryAnalytics.rta.inputs.filterByQueryText.fill('no-such-rta-query');

    await expect(queryAnalytics.rta.elements.noQueriesAvailable).toBeVisible();
    await expect(queryAnalytics.rta.buttons.export).toBeDisabled();
  });
});

pmmTest(
  'PMM-T2265 Verify RTA overview table state is stored in the URL and restored after refresh @rta',
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

pmmTest(
  'PMM-T2357 Verify RTA elapsed-time Min and Max filters accept only numbers and decimal values @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const olderQuery = 'rta-elapsed-filter-older';
    const newerQuery = 'rta-elapsed-filter-newer';
    const durationParameter = () => new URL(page.url()).searchParams.get(rta.durationFilterParameter);
    let rowsBeforeFilter = 0;
    let olderElapsed = 0;
    let newerElapsed = 0;

    await pmmTest.step('Run two long queries and pause RTA', async () => {
      void mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel: olderQuery,
      });
      // eslint-disable-next-line playwright/no-wait-for-timeout -- older query must lead the newer one by whole seconds
      await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      void mongoDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel: newerQuery,
      });

      await expect(rta.builders.rowByQueryText(newerQuery)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      // eslint-disable-next-line playwright/no-wait-for-timeout -- let the newer query pass one second of elapsed time
      await page.waitForTimeout(Timeouts.TWO_SECONDS);
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.openFilters();

      rowsBeforeFilter = await rta.elements.realTimeTableRow.count();
      olderElapsed = await rta.getElapsedTimeForQueryByText(olderQuery);
      newerElapsed = await rta.getElapsedTimeForQueryByText(newerQuery);

      expect(olderElapsed - newerElapsed).toBeGreaterThan(2);
      expect(newerElapsed).toBeGreaterThan(1);
      await expect(rta.inputs.minimumDuration).toHaveValue('');
      await expect(rta.inputs.maximumDuration).toHaveValue('');
    });

    await pmmTest.step('Verify letters typed into Min are dropped', async () => {
      await rta.inputs.minimumDuration.pressSequentially('abc');

      await expect(rta.inputs.minimumDuration).toHaveValue('');
      await expect(rta.elements.realTimeTableRow).toHaveCount(rowsBeforeFilter);
    });

    await pmmTest.step('Verify a unit typed after a number is dropped and the number filters', async () => {
      const bound = String(Math.floor(newerElapsed));

      await rta.inputs.minimumDuration.pressSequentially(`${bound}s`);

      await expect(rta.inputs.minimumDuration).toHaveValue(bound);
      await expect(rta.builders.rowByQueryText(olderQuery)).toBeVisible();
      await expect(rta.builders.rowByQueryText(newerQuery)).toBeVisible();
      expect((await rta.getDurations()).every((duration) => duration >= Number(bound))).toBe(true);
    });

    await pmmTest.step('Verify pasted text containing letters is refused', async () => {
      await rta.inputs.minimumDuration.fill('');
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.evaluate(async (text) => await navigator.clipboard.writeText(text), '12abc');
      await rta.inputs.minimumDuration.focus();
      await page.keyboard.press('ControlOrMeta+V');

      await expect(rta.inputs.minimumDuration).toHaveValue('');
      await expect(rta.elements.realTimeTableRow).toHaveCount(rowsBeforeFilter);
    });

    await pmmTest.step('Verify a minus sign is dropped', async () => {
      await rta.inputs.minimumDuration.pressSequentially('-1');

      await expect(rta.inputs.minimumDuration).toHaveValue('1');
      await rta.inputs.minimumDuration.fill('');
    });

    await pmmTest.step('Verify letters typed into Max are dropped', async () => {
      await rta.inputs.maximumDuration.pressSequentially('xyz');

      await expect(rta.inputs.maximumDuration).toHaveValue('');
      await expect(rta.elements.realTimeTableRow).toHaveCount(rowsBeforeFilter);
    });

    await pmmTest.step('Verify a lone decimal point is kept but filters nothing', async () => {
      await rta.inputs.maximumDuration.pressSequentially('.');

      await expect(rta.inputs.maximumDuration).toHaveValue('.');
      await expect(rta.elements.realTimeTableRow).toHaveCount(rowsBeforeFilter);
      await expect.poll(durationParameter).toBeNull();
    });

    await pmmTest.step('Verify a value starting with a decimal point filters', async () => {
      await rta.inputs.maximumDuration.pressSequentially('5');

      await expect(rta.inputs.maximumDuration).toHaveValue('.5');
      await expect(rta.builders.rowByQueryText(olderQuery)).toBeHidden();
      await expect(rta.builders.rowByQueryText(newerQuery)).toBeHidden();
      expect((await rta.getDurations()).every((duration) => duration <= 0.5)).toBe(true);
    });

    await pmmTest.step('Verify a value ending with a decimal point filters', async () => {
      const bound = `${Math.floor((olderElapsed + newerElapsed) / 2)}.`;

      await rta.inputs.maximumDuration.fill('');
      await rta.inputs.minimumDuration.pressSequentially(bound);
      await rta.inputs.maximumDuration.pressSequentially('999');

      await expect(rta.inputs.minimumDuration).toHaveValue(bound);
      await expect(rta.inputs.maximumDuration).toHaveValue('999');
      await expect(rta.builders.rowByQueryText(olderQuery)).toBeVisible();
      await expect(rta.builders.rowByQueryText(newerQuery)).toBeHidden();
      await expect.poll(durationParameter).toBe(JSON.stringify([bound, '999']));
    });

    await pmmTest.step('Verify clearing both bounds lists every query again', async () => {
      await rta.inputs.minimumDuration.fill('');
      await rta.inputs.maximumDuration.fill('');

      await expect(rta.elements.realTimeTableRow).toHaveCount(rowsBeforeFilter);
      await expect.poll(durationParameter).toBeNull();
    });
  },
);

pmmTest(
  'PMM-T2358 Verify RTA clears a non-numeric elapsed-time bound opened from a link @rta',
  async ({ mongoDbHelper, page, queryAnalytics }) => {
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-elapsed-filter-link';
    const durationParameter = () => new URL(page.url()).searchParams.get(rta.durationFilterParameter);

    await pmmTest.step('Run a long query and filter by a valid Min bound', async () => {
      void mongoDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.openFilters();
      await rta.inputs.minimumDuration.fill('1');

      await expect.poll(durationParameter).toBe(JSON.stringify(['1', '']));
    });

    await pmmTest.step('Open the link with a non-numeric Min bound', async () => {
      const link = new URL(page.url());

      link.searchParams.set(rta.durationFilterParameter, JSON.stringify(['999abc', '']));
      await page.goto(link.toString());
      await rta.elements.realTimeTable.waitFor({ state: 'visible' });
      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await rta.buttons.pauseRealTimeAnalytics.click();
      await rta.openFiltersIfHidden();
    });

    await pmmTest.step('Verify the bound is cleared and the table is not filtered', async () => {
      await expect(rta.inputs.minimumDuration).toHaveValue('');
      await expect(rta.elements.noQueriesAvailable).toBeHidden();
      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible();
      await expect.poll(durationParameter).toBeNull();
    });
  },
);
