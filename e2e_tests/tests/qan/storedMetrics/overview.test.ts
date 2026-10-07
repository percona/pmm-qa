import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
});

pmmTest('PMM-T207 - Verify hovering over query in overview table  @qan', async ({ qanStoredMetrics }) => {
  await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toBeVisible({
    timeout: Timeouts.THIRTY_SECONDS,
  });

  const queryText = (await qanStoredMetrics.builders.queryRowQueryText(1).textContent())?.replace(/ /g, '');

  await qanStoredMetrics.builders.queryInfoIcon(1).hover();
  await expect(qanStoredMetrics.elements.queryTooltipText).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await expect
    .poll(
      async () => (await qanStoredMetrics.elements.queryTooltipText.textContent())?.replace(/ |\n/g, ''),
      {
        message: 'The query text in the row should match the query text on the tooltip',
      },
    )
    .toBe(queryText);
});

pmmTest(
  'PMM-T1061 - Verify Plan and PlanID with pg_stat_monitor @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    await qanStoredMetrics.selectFilter(
      'pdpgsql_pmm',
      qanStoredMetrics.builders.filterCheckboxContaining('pdpgsql_pmm'),
    );
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await leftNavigation.selectTimeRange('Last 12 hours');
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await qanStoredMetrics.searchByValue('pgsm_t1 t1');
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toBeVisible({
      timeout: Timeouts.ONE_MINUTE,
    });
    await qanStoredMetrics.builders.queryInfoIcon(1).hover();
    await expect(qanStoredMetrics.elements.queryTooltipText).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    await expect(qanStoredMetrics.elements.queryTooltipId).toHaveText(/:\s*\S+/);

    const queryId = (await qanStoredMetrics.elements.queryTooltipId.textContent())?.split(':')[1].trim();

    await qanStoredMetrics.inputs.addColumn.hover();
    await expect(qanStoredMetrics.elements.metricTooltip).toBeHidden({ timeout: Timeouts.FIVE_SECONDS });

    await pmmTest.step('Open the Plan tab of the pgsm_t1 query', async () => {
      await qanStoredMetrics.builders.queryRow(1).click({ timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await qanStoredMetrics.builders.tab('Plan').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.noClassicExplain).toBeHidden();
      await expect(qanStoredMetrics.elements.noJsonExplain).toBeHidden();
      await expect(qanStoredMetrics.elements.explainError).toBeHidden();
      await expect(qanStoredMetrics.elements.emptyPlan).toBeHidden();
      await expect(qanStoredMetrics.elements.planText).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
      await expect(qanStoredMetrics.elements.planText).not.toBeEmpty();
    });

    await qanStoredMetrics.elements.planInfoIcon.hover();
    await expect(qanStoredMetrics.elements.planTooltip).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    await expect(qanStoredMetrics.elements.planTooltip).toHaveText(/:\s*\S+/);

    const planId = (await qanStoredMetrics.elements.planTooltip.textContent())?.split(':')[1].trim();

    await qanStoredMetrics.inputs.addColumn.hover();
    await expect(qanStoredMetrics.elements.metricTooltip).toBeHidden({ timeout: Timeouts.FIVE_SECONDS });
    expect(planId, 'Plan Id should not be equal to Query Id').not.toBe(queryId);

    await pmmTest.step('Open the Plan tab of the pg_stat_database query', async () => {
      await qanStoredMetrics.buttons.resetAll.click();
      await qanStoredMetrics.selectFilter(
        'pdpgsql_pmm',
        qanStoredMetrics.builders.filterCheckboxContaining('pdpgsql_pmm'),
      );
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await qanStoredMetrics.searchByValue('SELECT * FROM pg_stat_database');
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await qanStoredMetrics.builders.queryRow(1).click({ timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await qanStoredMetrics.builders.tab('Plan').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.noClassicExplain).toBeHidden();
      await expect(qanStoredMetrics.elements.noJsonExplain).toBeHidden();
      await expect(qanStoredMetrics.elements.explainError).toBeHidden();
      await expect(qanStoredMetrics.elements.emptyPlan).toBeHidden();
      await expect(qanStoredMetrics.elements.planText).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
      await expect(qanStoredMetrics.elements.planText).not.toBeEmpty();
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
    await qanStoredMetrics.builders.sortControl(2).dispatchEvent('click');
    await expect(qanStoredMetrics.builders.sortingValue(2)).toContainClass('sort-by asc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await leftNavigation.selectTimeRange('Last 1 hour');
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.builders.sortingValue(2)).toContainClass('sort-by asc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.builders.sortControl(1).dispatchEvent('click');
    await expect(qanStoredMetrics.builders.sortingValue(1)).toContainClass('sort-by asc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await qanStoredMetrics.builders.sortControl(1).dispatchEvent('click');
    await expect(qanStoredMetrics.builders.sortingValue(1)).toContainClass('sort-by desc', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.sortingValue(2)).toHaveAttribute('class', 'sort-by ', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T187 - Verify that the selected row in the overview table is highlighted @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryRow(2).click({ timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
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
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count with errors')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(qanStoredMetrics.builders.columnHeader('Load')).toBeVisible();
    await expect(page).toHaveURL(/num_queries_with_errors/);
    await page.reload();
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
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
    for (const [index, [columnNumber, direction]] of (
      [
        [1, 'asc'],
        [1, 'desc'],
        [2, 'asc'],
        [2, 'desc'],
        [3, 'asc'],
        [3, 'desc'],
      ] as const
    ).entries()) {
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });

      if (index > 0) await qanStoredMetrics.builders.sortControl(columnNumber).dispatchEvent('click');

      await expect(qanStoredMetrics.builders.sortingValue(columnNumber)).toContainClass(
        `sort-by ${direction}`,
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );
      await expect(async () => {
        const values = await qanStoredMetrics.getColumnValues(columnNumber);

        expect(values, `Column ${columnNumber} should show values`).not.toHaveLength(0);
        expect(
          values.filter((value) => !Number.isFinite(value)),
          `Column ${columnNumber} values should all be numeric`,
        ).toHaveLength(0);
        expect(values, `Column ${columnNumber} values should follow the "${direction}" sort`).toEqual(
          [...values].sort((a, b) => (direction === 'asc' ? b - a : a - b)),
        );
      }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
    }
  },
);

pmmTest(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Count Value @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.builders.queryValue(3, 2)).not.toBeEmpty({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const [queryCount] = ((await qanStoredMetrics.builders.queryValue(3, 2).textContent()) ?? '').split(' ');

    await qanStoredMetrics.builders.queryValue(3, 2).hover();
    await expect(qanStoredMetrics.elements.metricTooltip).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect
      .poll(
        async () =>
          (await qanStoredMetrics.elements.qpsTooltip.textContent())?.split(':')[1]?.trim().split(' ')[0],
      )
      .toBe(queryCount);
  },
);

pmmTest(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Time Value @qan',
  async ({ qanStoredMetrics }) => {
    const queryTime = (await qanStoredMetrics.builders.queryValue(3, 3).textContent()) ?? '';

    await qanStoredMetrics.builders.queryValue(3, 3).hover();
    await expect(qanStoredMetrics.elements.latencyChart).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect(qanStoredMetrics.elements.qpsTooltip).toContainText(`Per query : ${queryTime}`, {
      timeout: Timeouts.FIVE_SECONDS,
    });
  },
);

// eslint-disable-next-line playwright/no-skipped-test -- PMM-14002: small and N/A sparkline values; unskip and refactor once PMM-14002 is fixed.
pmmTest.skip('PMM-T204 - Verify small and N/A values on sparkline @qan', async ({ qanStoredMetrics }) => {
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await qanStoredMetrics.builders.sortControl(1).dispatchEvent('click');
  await expect(qanStoredMetrics.builders.sortingValue(1)).toContainClass('sort-by desc', {
    timeout: Timeouts.THIRTY_SECONDS,
  });
  await expect(qanStoredMetrics.builders.queryValue(3, 3)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  await qanStoredMetrics.builders.queryValue(3, 3).hover();
  await expect(qanStoredMetrics.elements.qpsTooltip).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await qanStoredMetrics.changeColumnMetric('Query Time', 'Innodb Queue Wait');
  await expect(qanStoredMetrics.builders.columnHeader('Innodb Queue Wait')).toBeVisible({
    timeout: Timeouts.THIRTY_SECONDS,
  });
  await expect(qanStoredMetrics.builders.columnHeader('Query Time')).toBeHidden();
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await expect(qanStoredMetrics.builders.queryValue(3, 3)).toBeAttached({ timeout: Timeouts.TEN_SECONDS });
  await qanStoredMetrics.builders.queryValue(3, 3).hover();
  await expect(qanStoredMetrics.elements.overviewColumnTooltip).toBeHidden();
  await expect(qanStoredMetrics.elements.qpsTooltip).toBeHidden();
});

pmmTest('PMM-T412 - Verify user is able to search by part of query @qan', async ({ qanStoredMetrics }) => {
  await qanStoredMetrics.searchByValue('SELECT pg_database');
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
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
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
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
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, {
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const queryCount = (await qanStoredMetrics.builders.queryValue(1, 2).textContent()) ?? '';

    await qanStoredMetrics.builders.queryInfoIcon(1).hover();
    await expect(qanStoredMetrics.elements.queryTooltipText).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    await expect(qanStoredMetrics.elements.queryTooltipId).toHaveText(/:\s*\S+/);

    const queryId = ((await qanStoredMetrics.elements.queryTooltipId.textContent()) ?? '')
      .split(':')[1]
      .trim();

    await qanStoredMetrics.searchByValue(queryId);
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.queryRows).not.toHaveCount(0, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      qanStoredMetrics.builders.queryValue(1, 2),
      `The search by Query Id ${queryId} should return the query it was taken from`,
    ).toHaveText(queryCount);
    await qanStoredMetrics.inputs.addColumn.hover();
    await qanStoredMetrics.builders.queryInfoIcon(1).hover();
    await expect(qanStoredMetrics.elements.queryTooltipId).toContainText(queryId);
  },
);

pmmTest(
  'PMM-T134 - Verify user is able to remove metric from the overview table @qan',
  async ({ page, qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryRow(1).click({ timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(qanStoredMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeVisible();
    await qanStoredMetrics.removeColumn('Query Count');
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeHidden();
    await page.reload();
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.inputs.addColumn).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeHidden();
  },
);

pmmTest(
  "PMM-T220 - Verify that last column can't be removed from Overview table @qan",
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.builders.queryRow(1).click({ timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(qanStoredMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.builders.columnHeader('Query Count')).toBeVisible();

    for (const columnName of ['Query Count', 'Query Time']) {
      await qanStoredMetrics.removeColumn(columnName);
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
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
      await expect(async () => {
        await qanStoredMetrics.inputs.addColumn.hover();
        await qanStoredMetrics.builders.loadSparkline(2).hover();
        await expect(
          qanStoredMetrics.elements.sparklineTooltip,
          'The timestamp should contain the local time offset',
        ).toContainText('+09', { timeout: Timeouts.FIVE_SECONDS });
      }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
      await leftNavigation.selectTimeZone('Coordinated Universal Time');
      await page.reload();
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(async () => {
        await qanStoredMetrics.inputs.addColumn.hover();
        await qanStoredMetrics.builders.loadSparkline(2).hover();
        await expect(
          qanStoredMetrics.elements.sparklineTooltip,
          'The timestamp should contain the zero UTC time offset',
        ).toContainText('+00:00', { timeout: Timeouts.FIVE_SECONDS });
      }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
    },
  );
});
