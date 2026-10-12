import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
  await qanStoredMetrics.waitForLoad();
});

pmmTest('PMM-T207 - Verify hovering over query in overview table  @qan', async ({ qanStoredMetrics }) => {
  const queryText = await qanStoredMetrics.getQueryText(1);

  await qanStoredMetrics.hoverQueryInfo(1);
  await expect
    .poll(() => qanStoredMetrics.getQueryTooltipText(), {
      message: 'The query text in the row should match the query text on the tooltip',
    })
    .toBe(queryText);
});

pmmTest(
  'PMM-T1061 - Verify Plan and PlanID with pg_stat_monitor @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    await qanStoredMetrics.selectFilterContaining('pdpgsql_pmm');
    await leftNavigation.selectTimeRange('Last 12 hours');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.searchByValue('pgsm_t1 t1');
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toBeVisible({
      timeout: Timeouts.ONE_MINUTE,
    });

    const queryId = await qanStoredMetrics.getQueryId(1);

    await qanStoredMetrics.hideTooltip();

    await pmmTest.step('Open the Plan tab of the pgsm_t1 query', async () => {
      await qanStoredMetrics.selectRow(1);
      await qanStoredMetrics.openPlanTab();
      await qanStoredMetrics.verifyPlanShown();
    });

    const planId = await qanStoredMetrics.getPlanId();

    await qanStoredMetrics.hideTooltip();
    expect(planId, 'Plan Id should not be equal to Query Id').not.toBe(queryId);

    await pmmTest.step('Open the Plan tab of the pg_stat_database query', async () => {
      await qanStoredMetrics.buttons.resetAll.click();
      await qanStoredMetrics.selectFilterContaining('pdpgsql_pmm');
      await qanStoredMetrics.searchByValue('SELECT * FROM pg_stat_database');
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectRow(1);
      await qanStoredMetrics.openPlanTab();
      await qanStoredMetrics.verifyPlanShown();
    });
  },
);

pmmTest(
  'PMM-T146 - Verify user is able to see  chart tooltip for time related metric  @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryValue(1, 3).hover({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.elements.metricTooltip).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.elements.latencyChart).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T151 - Verify that hovering over a non-time metric displays a tooltip without a graph @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryValue(1, 2).hover({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.elements.metricTooltip).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.elements.latencyChart).toBeHidden();
  },
);

pmmTest(
  'PMM-T171 - Verify that changing the time range doesnt reset sorting, Open the QAN Dashboard and check that sorting works correctly after sorting by another column. @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    await qanStoredMetrics.sortColumn(2, 'asc');
    await qanStoredMetrics.waitForLoad();
    await leftNavigation.selectTimeRange('Last 1 hour');
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.builders.sortingValue(2)).toContainClass('sort-by asc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.sortColumn(1, 'asc');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.sortColumn(1, 'desc');
    await expect(qanStoredMetrics.builders.sortingValue(2)).toHaveAttribute('class', 'sort-by ', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T187 - Verify that the selected row in the overview table is highlighted @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.selectRow(2);
    await expect(qanStoredMetrics.elements.selectedRowCell).toHaveCSS('background-color', 'rgb(35, 70, 130)');
  },
);

pmmTest(
  'PMM-T133 + PMM-T132 + PMM-T100 - Check Changing Main Metric, PMM-T203 Verify user is able to search for columns by typing @qan @gssapi-nightly',
  async ({ page, qanStoredMetrics }) => {
    await expect(qanStoredMetrics.elements.addColumnButton).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.changeColumnMetric('Load', 'Query Count with errors');
    await expect(qanStoredMetrics.builders.columnHeader('Query Count with errors')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeHidden();
    await expect(page).toHaveURL(/num_queries_with_errors/);
    await page.reload();
    await expect(qanStoredMetrics.elements.addColumnButton).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count with errors')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeHidden();
  },
);

pmmTest(
  'PMM-T99 - Verify User is able to add new metric, PMM-T222 Verify `Add column` dropdown works @qan',
  async ({ page, qanStoredMetrics }) => {
    await qanStoredMetrics.addColumn('Query Count with errors');
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.builders.columnHeader('Query Count with errors')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeVisible();
    await expect(page).toHaveURL(/num_queries_with_errors/);
    await page.reload();
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.elements.addColumnButton).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count with errors')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeVisible();
  },
);

pmmTest(
  'PMM-T135 - Verify user is not able to add duplicate metric to the overview column @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.inputs.addColumn.fill('Load');
    await expect(qanStoredMetrics.elements.addColumnNoData).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T156 - Verify Queries are sorted by Load by Default Sorting from Max to Min, verify Sorting for Metrics works @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.builders.sortingValue(1)).toContainClass('sort-by asc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.verifyColumnSorted(1, 'asc');

    for (const [columnNumber, direction] of [
      [1, 'desc'],
      [2, 'asc'],
      [2, 'desc'],
      [3, 'asc'],
      [3, 'desc'],
    ] as const) {
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.sortColumn(columnNumber, direction);
      await qanStoredMetrics.verifyColumnSorted(columnNumber, direction);
    }
  },
);

pmmTest(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Count Value @qan',
  async ({ qanStoredMetrics }) => {
    const [queryCount] = (await qanStoredMetrics.getQueryValue(3, 2)).split(' ');

    await qanStoredMetrics.builders.queryValue(3, 2).hover();
    await expect(qanStoredMetrics.elements.metricTooltip).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect.poll(() => qanStoredMetrics.getQpsTooltipValue()).toBe(queryCount);
  },
);

pmmTest(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Time Value @qan',
  async ({ qanStoredMetrics }) => {
    const queryTime = await qanStoredMetrics.getQueryValue(3, 3);

    await qanStoredMetrics.builders.queryValue(3, 3).hover();
    await expect(qanStoredMetrics.elements.latencyChart).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect(qanStoredMetrics.elements.qpsTooltip).toContainText(`Per query : ${queryTime}`, {
      timeout: Timeouts.FIVE_SECONDS,
    });
  },
);

// eslint-disable-next-line playwright/no-skipped-test -- PMM-14002: small and N/A sparkline values; unskip and refactor once PMM-14002 is fixed.
pmmTest.skip('PMM-T204 - Verify small and N/A values on sparkline @qan', async ({ qanStoredMetrics }) => {
  await qanStoredMetrics.sortColumn(1, 'desc');
  await expect(qanStoredMetrics.builders.queryValue(3, 3)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  await qanStoredMetrics.builders.queryValue(3, 3).hover();
  await expect(qanStoredMetrics.elements.qpsTooltip).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  await qanStoredMetrics.waitForLoad();
  await qanStoredMetrics.changeColumnMetric('Query Time', 'Innodb Queue Wait');
  await expect(qanStoredMetrics.builders.columnHeader('Innodb Queue Wait')).toBeVisible({
    timeout: Timeouts.THIRTY_SECONDS,
  });
  await expect(qanStoredMetrics.builders.columnHeader('Query Time')).toBeHidden();
  await qanStoredMetrics.waitForLoad();
  await expect(qanStoredMetrics.builders.queryValue(3, 3)).toBeAttached({ timeout: Timeouts.TEN_SECONDS });
  await qanStoredMetrics.builders.queryValue(3, 3).hover();
  await expect(qanStoredMetrics.elements.overviewColumnTooltip).toBeHidden();
  await expect(qanStoredMetrics.elements.qpsTooltip).toBeHidden();
});

pmmTest('PMM-T412 - Verify user is able to search by part of query @qan', async ({ qanStoredMetrics }) => {
  await qanStoredMetrics.searchByValue('SELECT pg_database');
  await qanStoredMetrics.waitForLoad();
  await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, { timeout: Timeouts.THIRTY_SECONDS });
  await expect(
    qanStoredMetrics.builders.queryRowQueryText(1),
    'The first search result should start with the searched query text',
  ).toHaveText(/^SELECT pg_database/);
});

pmmTest(
  'PMM-T417 - Verify user is able to search by Database, PMM-T183 Verify that "Group by" in the overview table can be changed @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Query', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.changeMainMetric('Database');
    await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Database', {
      timeout: Timeouts.TEN_SECONDS,
    });
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.searchByValue('postgres');
    await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      qanStoredMetrics.builders.queryRowQueryText(1),
      'The first search result should be the searched database',
    ).toHaveText('postgres');
  },
);

pmmTest(
  'PMM-T127 - Verify user is able to Group By overview table results @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Query', {
      timeout: Timeouts.THIRTY_SECONDS,
    });

    for (const groupBy of ['Service Name', 'Database', 'Schema', 'User Name', 'Client Host', 'Query']) {
      await qanStoredMetrics.changeMainMetric(groupBy);
      await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText(groupBy, {
        timeout: Timeouts.TEN_SECONDS,
      });
    }
  },
);

pmmTest(
  'PMM-T411 + PMM-T400 + PMM-T414 - Verify search filed is displayed, Verify user is able to search the query id specified time range, Verify searching by Query ID @qan',
  async ({ page, qanStoredMetrics, urlHelper }) => {
    const now = Date.now();

    await expect(page).toHaveURL(/order_by=/, { timeout: Timeouts.THIRTY_SECONDS });
    await page.goto(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
        from: String(now - 7 * 60_000),
        to: String(now - 2 * 60_000),
      }),
    );
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, {
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const queryCount = await qanStoredMetrics.getQueryValue(1, 2);
    const queryId = await qanStoredMetrics.getQueryId(1);

    await qanStoredMetrics.searchByValue(queryId);
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      qanStoredMetrics.builders.queryValue(1, 2),
      `The search by Query Id ${queryId} should return the query it was taken from`,
    ).toHaveText(queryCount);
    await qanStoredMetrics.hideTooltip();
    expect(await qanStoredMetrics.getQueryId(1)).toBe(queryId);
  },
);

pmmTest(
  'PMM-T134 - Verify user is able to remove metric from the overview table @qan',
  async ({ page, qanStoredMetrics }) => {
    await qanStoredMetrics.selectRow(1);
    await expect(qanStoredMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeVisible();
    await qanStoredMetrics.removeColumn('Query Count');
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeHidden();
    await page.reload();
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.inputs.addColumn).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeHidden();
  },
);

pmmTest(
  "PMM-T220 - Verify that last column can't be removed from Overview table @qan",
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.selectRow(1);
    await expect(qanStoredMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeVisible();

    for (const columnName of ['Query Count', 'Query Time']) {
      await qanStoredMetrics.removeColumn(columnName);
      await qanStoredMetrics.waitForLoad();
      await expect(qanStoredMetrics.builders.columnHeader(columnName)).toBeHidden();
    }

    await qanStoredMetrics.builders.columnHeader('Load').click();
    await expect(qanStoredMetrics.builders.overviewColumnOption('Query Count with errors')).toBeVisible();
    await expect(qanStoredMetrics.elements.removeColumnOption).toBeHidden();
  },
);

pmmTest.describe(() => {
  pmmTest.use({ timezoneId: 'Asia/Tokyo' });

  pmmTest(
    'PMM-T1699 - Verify that query time is shown in UTC timezone after hovering Load graph for query if user selected UTC timezone @qan @gssapi-nightly',
    async ({ leftNavigation, page, qanStoredMetrics }) => {
      await qanStoredMetrics.verifyLoadSparklineTooltip(2, '+09');
      await leftNavigation.selectTimeZone('Coordinated Universal Time');
      await expect(page).toHaveURL(/timezone=utc/);
      await page.reload();
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.verifyLoadSparklineTooltip(2, '+00:00');
    },
  );
});
