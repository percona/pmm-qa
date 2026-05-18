const assert = require('assert');

Feature('QAN overview').retry(1);

Before(async ({
  I, queryAnalyticsPage,
}) => {
  await I.Authorize();
  I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
  queryAnalyticsPage.waitForLoaded();
});

Scenario(
  'PMM-T207 - Verify hovering over query in overview table  @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(queryAnalyticsPage.data.elements.queryRowValue(1), 30);
    let firstQueryText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryRowValue(1));

    firstQueryText = firstQueryText.replace(/ /g, '');
    queryAnalyticsPage.data.mouseOverInfoIcon(1);

    let tooltipQueryText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryTooltipValue);

    tooltipQueryText = tooltipQueryText.replace(/ /g, '').replace(/\n/g, '');
    assert.ok(firstQueryText === tooltipQueryText, `The request text: ${firstQueryText}, don't match the request text on the tooltip: ${tooltipQueryText}.`);
  },
);

Scenario(
  'PMM-T1061 - Verify Plan and PlanID with pg_stat_monitor @qan',
  async ({
    I, adminPage, queryAnalyticsPage,
  }) => {
    queryAnalyticsPage.filters.selectContainFilter('pdpgsql_pmm');
    queryAnalyticsPage.waitForLoaded();
    await adminPage.applyTimeRange('Last 12 hours');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue('query_plan');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.mouseOverInfoIcon(1);

    const tooltipQueryId = await queryAnalyticsPage.data.getTooltipQueryId();

    await queryAnalyticsPage.data.hideTooltip();

    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.queryDetails.checkTab('Plan');
    await queryAnalyticsPage.queryDetails.checkPlanTabIsNotEmpty();
    await queryAnalyticsPage.queryDetails.mouseOverPlanInfoIcon();

    let tooltipPlanId = await I.grabTextFrom(queryAnalyticsPage.queryDetails.elements.tooltipPlanId);

    tooltipPlanId = tooltipPlanId.split(':');
    tooltipPlanId = tooltipPlanId[1].trim();
    await queryAnalyticsPage.data.hideTooltip();
    assert.notEqual(tooltipQueryId, tooltipPlanId, 'Plan Id should not be equal to Query Id');
    queryAnalyticsPage.filters.resetAllFilters();
    queryAnalyticsPage.data.searchByValue('SELECT * FROM pg_stat_database');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.queryDetails.checkTab('Plan');
    await queryAnalyticsPage.queryDetails.checkPlanTabIsNotEmpty();
  },
).retry(2);

Scenario(
  'PMM-T146 - Verify user is able to see  chart tooltip for time related metric  @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.showTooltip(1, 3);
    I.seeElement(queryAnalyticsPage.data.elements.latencyChart);
  },
);

Scenario(
  'PMM-T151 - Verify that hovering over a non-time metric displays a tooltip without a graph @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.showTooltip(1, 2);
    I.dontSeeElement(queryAnalyticsPage.data.elements.latencyChart);
  },
);

Scenario(
  'PMM-T171 - Verify that changing the time range doesnt reset sorting, Open the QAN Dashboard and check that sorting works correctly after sorting by another column. @qan',
  async ({ adminPage, queryAnalyticsPage }) => {
    queryAnalyticsPage.changeSorting(2);
    queryAnalyticsPage.data.verifySorting(2, 'asc');
    queryAnalyticsPage.waitForLoaded();
    await adminPage.applyTimeRange('Last 1 hour');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.verifySorting(2, 'asc');
    queryAnalyticsPage.changeSorting(1);
    queryAnalyticsPage.data.verifySorting(1, 'asc');
    queryAnalyticsPage.changeSorting(1);
    queryAnalyticsPage.data.verifySorting(1, 'desc');
    queryAnalyticsPage.data.verifySorting(2);
  },
);

Scenario(
  'PMM-T156 - Verify that by default, queries are sorted by Load, from max to min @qan',
  async ({ queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.verifySorting(1, 'asc');
  },
);

Scenario(
  'PMM-T183 - Verify that "Group by" in the overview table can be changed @qan',
  async ({ I, queryAnalyticsPage }) => {
    I.waitForText('Query', 30, queryAnalyticsPage.data.elements.selectedMainMetric());
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.changeMainMetric('Database');
    queryAnalyticsPage.data.verifyMainMetric('Database');
  },
);

Scenario(
  'PMM-T187 - Verify that the selected row in the overview table is highlighted @qan',
  async ({ I, queryAnalyticsPage }) => {
    const expectedColor = 'rgb(35, 70, 130)';

    queryAnalyticsPage.data.selectRow('2');
    const color = await I.grabCssPropertyFrom(`${queryAnalyticsPage.data.elements.selectedRow} > div`, 'background-color');

    assert.ok(color === expectedColor, `Row background color should be ${expectedColor} but it is ${color}`);
  },
);

Scenario(
  'PMM-T133 + PMM-T132 + PMM-T100 - Check Changing Main Metric, PMM-T203 Verify user is able to search for columns by typing @qan @gssapi-nightly',
  async ({ I, queryAnalyticsPage }) => {
    const metricName = 'Query Count with errors';

    await I.waitForElement(queryAnalyticsPage.buttons.addColumnButton, 30);
    await queryAnalyticsPage.data.changeMetric('Load', metricName);
    await I.seeInCurrentUrl('num_queries_with_errors');
    const url = await I.grabCurrentUrl();

    await I.amOnPage(url);
    await I.waitForElement(queryAnalyticsPage.buttons.addColumnButton, 30);
    await I.waitForElement(queryAnalyticsPage.data.fields.columnHeader(metricName), 30);
    await I.dontSeeElement(queryAnalyticsPage.data.fields.columnHeader('Load'));
  },
);

Scenario(
  'PMM-T99 - Verify User is able to add new metric, PMM-T222 Verify `Add column` dropdown works @qan',
  async ({ I, queryAnalyticsPage }) => {
    const metricName = 'Query Count with errors';
    const urlString = 'num_queries_with_errors';
    const newMetric = queryAnalyticsPage.data.fields.columnHeader(metricName);
    const oldMetric = queryAnalyticsPage.data.fields.columnHeader('Load');

    queryAnalyticsPage.addColumn(metricName);
    queryAnalyticsPage.waitForLoaded();
    I.waitForElement(newMetric, 30);
    I.seeElement(newMetric);
    I.seeElement(oldMetric);
    I.seeInCurrentUrl(urlString);
    const url = await I.grabCurrentUrl();

    I.amOnPage(url);
    queryAnalyticsPage.waitForLoaded();
    I.waitForElement(queryAnalyticsPage.buttons.addColumnButton, 30);
    I.waitForElement(newMetric, 30);
    I.seeElement(oldMetric);
    I.seeElement(newMetric);
  },
);

Scenario(
  'PMM-T135 - Verify user is not able to add duplicate metric to the overview column @qan',
  async ({ I, queryAnalyticsPage }) => {
    const columnName = 'Load';
    const column = queryAnalyticsPage.data.fields.columnHeader(columnName);

    await I.waitForVisible(column, 30);
    await I.seeElement(column);
    await I.fillField(queryAnalyticsPage.buttons.addColumn, columnName);
    await I.waitForVisible(queryAnalyticsPage.data.elements.addColumnNoDataIcon, 30);
    await I.seeElement(queryAnalyticsPage.data.elements.addColumnNoDataIcon);
  },
);

xScenario(
  'PMM-T219 - Verify that user is able to scroll up/down and resize the overview table @qan',
  async ({ I }) => {
    const columnsToAdd = [
      'Bytes Sent',
      'Reading Blocks Time',
      'Local Blocks Read',
      'Local Blocks Dirtied',
      'Temp Blocks Read',
      'Local Blocks Written',
      'Full Scan',
    ];

    // for (const i in columnsToAdd) {
    //   anOverview.addSpecificColumn(columnsToAdd[i]);
    // }

    // I.waitForElement(anOverview.getColumnLocator('Local Blocks Written'), 30);
    // I.scrollTo(anOverview.getColumnLocator('Local Blocks Written'), 30);
    // I.moveCursorTo(anOverview.elements.querySelector);
    // I.waitForVisible(anOverview.elements.querySelector);
    // I.click(anOverview.elements.querySelector);
    // I.scrollTo(anOverview.getRowLocator(10));
    // I.waitForVisible(anOverview.getColumnLocator('Query Time'), 30);
    // I.waitForVisible(anDetails.elements.resizer, 30);
    // I.dragAndDrop(anDetails.elements.resizer, anOverview.getColumnLocator('Query Time'));
    // I.scrollTo(anOverview.getColumnLocator('Query Time'));
  },
);

Scenario(
  'PMM-T156 - Verify Queries are sorted by Load by Default Sorting from Max to Min, verify Sorting for Metrics works @qan',
  async ({ queryAnalyticsPage }) => {
    queryAnalyticsPage.data.verifySorting(1, 'asc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Load', 3, 'down');
    queryAnalyticsPage.changeSorting(1);
    queryAnalyticsPage.data.verifySorting(1, 'desc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Load', 3, 'up');
    queryAnalyticsPage.changeSorting(2);
    queryAnalyticsPage.data.verifySorting(2, 'asc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Query Count', 4, 'down');
    queryAnalyticsPage.changeSorting(2);
    queryAnalyticsPage.data.verifySorting(2, 'desc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Query Count', 4, 'up');
    queryAnalyticsPage.changeSorting(3);
    queryAnalyticsPage.data.verifySorting(3, 'asc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Query Time', 5, 'down');
    queryAnalyticsPage.changeSorting(3);
    queryAnalyticsPage.data.verifySorting(3, 'desc');
    await queryAnalyticsPage.data.verifyMetricsSorted('Query Time', 5, 'up');
  },
);

Scenario(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Count Value @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    const firstCell = queryAnalyticsPage.data.elements.queryValue(3, 2);

    const [queryCount] = (await I.grabTextFrom(firstCell)).split(' ');

    I.moveCursorTo(firstCell);
    I.waitForVisible(queryAnalyticsPage.data.elements.metricTooltip, 20);
    I.assertTrue((await I.grabTextFrom(queryAnalyticsPage.data.elements.tooltipQPSValue)).includes(queryCount), `Expected QPS value: ${queryCount} does not equal displayed one: ${await I.grabTextFrom(queryAnalyticsPage.data.elements.tooltipQPSValue)}`);
  },
);

Scenario(
  'PMM-T179 - Verify user is able to hover sparkline buckets and see correct Query Time Value @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    const secondCell = queryAnalyticsPage.data.elements.queryValue(3, 3);

    const queryTime = await I.grabTextFrom(secondCell);

    I.moveCursorTo(secondCell);
    I.waitForVisible(queryAnalyticsPage.data.elements.latencyChart, 20);
    await queryAnalyticsPage.data.verifyTooltipValue(`Per query : ${queryTime}`);
  },
);

// TODO: Un-skip and refactor after https://perconadev.atlassian.net/browse/PMM-14002 is fixed
Scenario.skip(
  'PMM-T204 - Verify small and N/A values on sparkline @qan',
  async ({ I, queryAnalyticsPage }) => {
    const secondCell = queryAnalyticsPage.data.elements.queryValue(3, 3);

    queryAnalyticsPage.changeSorting(1);
    queryAnalyticsPage.data.verifySorting(1, 'desc');
    I.waitForVisible(secondCell, 10);
    I.moveCursorTo(secondCell);
    I.waitForVisible(queryAnalyticsPage.data.elements.tooltipQPSValue, 10);
    queryAnalyticsPage.data.changeMetric('Query Time', 'Innodb Queue Wait');
    queryAnalyticsPage.waitForLoaded();
    I.seeElementInDOM(secondCell, 10);
    I.moveCursorTo(secondCell);
    I.dontSeeElement(queryAnalyticsPage.data.elements.tooltip);
    I.dontSeeElement(queryAnalyticsPage.data.elements.tooltipQPSValue);
  },
);

Scenario(
  'PMM-T412 - Verify user is able to search by part of query @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const query = 'SELECT pg_database';

    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue(query);
    queryAnalyticsPage.waitForLoaded();
    await I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    const firstQueryText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryRowValue(1));

    assert.ok(firstQueryText.startsWith(query), `The Searched Query text was: "${query}", don't match the result text in overview for 1st result: "${firstQueryText}"`);
  },
).retry(2);

Scenario(
  'PMM-T417 - Verify user is able to search by Database @qan',
  async ({ I, queryAnalyticsPage }) => {
    const groupBy = 'Database';
    const query = 'postgres';

    I.waitForText('Query', 30, queryAnalyticsPage.data.elements.selectedMainMetric());
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.changeMainMetric(groupBy);
    queryAnalyticsPage.data.verifyMainMetric(groupBy);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue(query);
    I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    const firstQueryText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryRowValue(1));

    assert.ok(firstQueryText === query, `The Searched text was: ${query}, don't match the result text in overview for 1st result: ${firstQueryText}`);
  },
);

Scenario(
  'PMM-T127 - Verify user is able to Group By overview table results @qan',
  async ({ I, queryAnalyticsPage }) => {
    I.waitForText('Query', 30, queryAnalyticsPage.data.elements.selectedMainMetric());
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.changeMainMetric('Service Name');
    queryAnalyticsPage.data.verifyMainMetric('Service Name');
    await queryAnalyticsPage.data.changeMainMetric('Database');
    queryAnalyticsPage.data.verifyMainMetric('Database');
    await queryAnalyticsPage.data.changeMainMetric('Schema');
    queryAnalyticsPage.data.verifyMainMetric('Schema');
    await queryAnalyticsPage.data.changeMainMetric('User Name');
    queryAnalyticsPage.data.verifyMainMetric('User Name');
    await queryAnalyticsPage.data.changeMainMetric('Client Host');
    queryAnalyticsPage.data.verifyMainMetric('Client Host');
    await queryAnalyticsPage.data.changeMainMetric('Query');
    queryAnalyticsPage.data.verifyMainMetric('Query');
  },
);

Scenario(
  'PMM-T411 + PMM-T400 + PMM-T414 - Verify search filed is displayed, Verify user is able to search the query id specified time range, Verify searching by Query ID @qan',
  async ({ I, queryAnalyticsPage }) => {
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(queryAnalyticsPage.data.elements.queryRows, 30);
    const firstQueryText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryValue(1, 2));

    queryAnalyticsPage.data.mouseOverInfoIcon(1);

    let tooltipQueryId = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryTooltipId);

    tooltipQueryId = tooltipQueryId.split(':');

    // fetch the query id field value, split to get just the queryId
    tooltipQueryId = tooltipQueryId[1].trim();
    await queryAnalyticsPage.data.searchByValue(tooltipQueryId);
    I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    const firstQuerySearchText = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryValue(1, 2));

    assert.ok(firstQuerySearchText === firstQueryText, `The search with Query Id: ${tooltipQueryId} was supposed to result in Query with value: ${firstQueryText} but the resulted query found is ${firstQuerySearchText}`);
  },
);

Scenario(
  'PMM-T134 - Verify user is able to remove metric from the overview table @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const metricName = 'Query Count';

    await queryAnalyticsPage.data.selectRow(1);
    await queryAnalyticsPage.waitForLoaded();
    await I.waitForElement(queryAnalyticsPage.queryDetails.buttons.close, 30);
    await I.seeElement(queryAnalyticsPage.data.fields.columnHeader(metricName));
    await queryAnalyticsPage.data.removeMetricFromOverview(metricName);
    const url = await I.grabCurrentUrl();

    await I.amOnPage(url);
    await queryAnalyticsPage.waitForLoaded();
    await I.waitForElement(queryAnalyticsPage.buttons.addColumn, 30);
    await I.dontSeeElement(queryAnalyticsPage.data.fields.columnHeader(metricName));
  },
);

Scenario(
  'PMM-T220 - Verify that last column can\'t be removed from Overview table @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    await queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    await I.waitForElement(queryAnalyticsPage.queryDetails.buttons.close, 30);
    await I.seeElement(queryAnalyticsPage.data.fields.columnHeader('Query Count'));
    await queryAnalyticsPage.data.removeMetricFromOverview('Query Count');
    await queryAnalyticsPage.data.removeMetricFromOverview('Query Time');

    await I.waitForElement(queryAnalyticsPage.data.fields.columnHeader('Load'));
    await I.click(queryAnalyticsPage.data.fields.columnHeader('Load'));
    await I.waitForElement(queryAnalyticsPage.data.fields.searchBy, 10);
    await I.dontSeeElement(queryAnalyticsPage.data.elements.removeMetricColumn);
  },
);

Scenario(
  'PMM-T1699 - Verify that query time is shown in UTC timezone after hovering Load graph for query if user selected UTC timezone @qan @gssapi-nightly',
  async ({ I, adminPage, queryAnalyticsPage }) => {
    I.waitForVisible(queryAnalyticsPage.data.elements.loadColumn('2'));
    I.moveCursorTo(queryAnalyticsPage.data.elements.loadColumn('2'));
    let timestamp = await I.grabTextFrom(queryAnalyticsPage.data.elements.tooltipContent);

    const clientTimeOffset = new Intl.NumberFormat('en-US', {
      minimumIntegerDigits: 2,
      signDisplay: 'exceptZero',
    }).format(-new Date().getTimezoneOffset() / 60);

    I.assertContain(
      timestamp,
      clientTimeOffset,
      `Timestamp does not contain expected local time offset, but contains ${timestamp}`,
    );

    adminPage.applyTimeZone('Coordinated Universal Time');
    I.click(queryAnalyticsPage.buttons.refresh);
    I.waitForVisible(queryAnalyticsPage.data.elements.loadColumn('2'));
    I.moveCursorTo(queryAnalyticsPage.data.elements.loadColumn('2'));
    timestamp = await I.grabTextFrom(queryAnalyticsPage.data.elements.tooltipContent);

    I.assertContain(
      timestamp,
      '+00:00',
      `Timestamp does not contain expected zero UTC time offset, but contains ${timestamp}`,
    );
  },
);
