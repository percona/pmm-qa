const assert = require('assert');

const shortCutTests = new DataTable(['type', 'dashboard', 'shortcutLink', 'filter']);

shortCutTests.add(['Cluster', 'MongoDB Cluster Summary', 'graph/d/mongodb-cluster-summary/mongodb-cluster-summary', 'mongodb_node_cluster']);
shortCutTests.add(['Replication Set', 'MySQL Replication Summary', 'graph/d/mysql-replicaset-summary/mysql-replication-summary', 'ps-repl1']);
shortCutTests.add(['Node Name', 'Node Summary', 'graph/d/node-instance-summary/node-summary?var-node_name=pmm-server', 'pmm-server']);
shortCutTests.add(['Service Name', 'MongoDB Instance Summary', 'graph/d/mongodb-instance-summary/mongodb-instance-summary', 'mongodb_rs1_2']);

Feature('QAN filters').retry(1);

// filterToApply - filter witch we check, searchValue - value to get zero search result
const filters = new DataTable(['filterToApply', 'searchValue']);

filters.add(['SELECT', 'INSERT INTO']);
// FIXME: unskip when https://jira.percona.com/browse/PMM-11657 is fixed
// filters.add(['INSERT', 'SELECT']);
// filters.add(['UPDATE', 'DELETE']);
// filters.add(['DELETE', 'UPDATE']);

Before(async ({ I, queryAnalyticsPage }) => {
  await I.Authorize();
  I.amOnPage(queryAnalyticsPage.url);
  queryAnalyticsPage.waitForLoaded();
});

Data(filters).Scenario(
  'PMM-T1054 + PMM-T1055 - Verify the "Command type" filter for Postgres @qan',
  async ({
    I, current, queryAnalyticsPage,
  }) => {
    queryAnalyticsPage.filters.selectContainFilter('pdpgsql_pgsm_pmm');
    I.waitForVisible(queryAnalyticsPage.filters.buttons.showSelected, 30);
    queryAnalyticsPage.filters.selectFilterInGroup(current.filterToApply, 'Command Type');
    queryAnalyticsPage.data.searchByValue(current.searchValue);
    await I.waitForVisible(queryAnalyticsPage.data.elements.noResultTableText, 30);
    await I.seeTextEquals(queryAnalyticsPage.data.messages.noResultTableText, queryAnalyticsPage.data.elements.noResultTableText);
  },
);

Scenario(
  'PMM-T175 - Verify user is able to apply filter that has dots in label @qan',
  async ({ I, queryAnalyticsPage }) => {
    const serviceName = '127.0.0.1';

    const countBefore = await queryAnalyticsPage.data.getCountOfItems();

    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectContainFilter(serviceName);
    I.seeInCurrentUrl(`client_host=${serviceName}`);
    const countAfter = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countBefore !== countAfter, 'Query count was expected to change');
  },
);

Scenario(
  'PMM-T172 - Verify that selecting a filter updates the table data and URL @qan',
  async ({ I, queryAnalyticsPage }) => {
    const environmentName = 'pxc-dev';

    const countBefore = await queryAnalyticsPage.data.getCountOfItems();

    await queryAnalyticsPage.filters.selectFilter(environmentName);
    I.seeInCurrentUrl(`environment=${environmentName}`);
    const countAfter = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countBefore !== countAfter, 'Query count was expected to change');
  },
);

Scenario(
  'PMM-T126 - Verify user is able to Reset All filters @qan',
  async ({ I, queryAnalyticsPage }) => {
    const environmentName1 = 'pxc-dev';
    const environmentName2 = 'dev';

    const countBefore = await queryAnalyticsPage.data.getCountOfItems();

    queryAnalyticsPage.filters.selectFilter(environmentName1);
    queryAnalyticsPage.filters.selectFilter(environmentName2);
    queryAnalyticsPage.data.waitForNewItemsCount(countBefore);
    const countAfter = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countAfter !== countBefore, 'Query count was expected to change');

    queryAnalyticsPage.filters.resetAllFilters();
    I.seeAttributesOnElements(queryAnalyticsPage.filters.buttons.resetAll, { disabled: true });
    const countAfterReset = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countAfterReset >= countBefore, 'Query count wasn\'t expected to change');
  },
);

Scenario(
  'PMM-T125 - Verify user is able to Show only selected filter values and Show All filter values @qan',
  async ({ I, queryAnalyticsPage }) => {
    const environmentName1 = 'pxc-dev';
    const environmentName2 = 'dev';

    queryAnalyticsPage.filters.selectFilter(environmentName1);
    queryAnalyticsPage.filters.selectFilter(environmentName2);
    I.wait(5);
    I.waitForVisible(queryAnalyticsPage.filters.buttons.showSelected, 30);
    queryAnalyticsPage.filters.showSelectedFilters();
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(2, 'equals');
    queryAnalyticsPage.filters.showSelectedFilters();
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(2, 'bigger');
  },
);

Scenario(
  'PMM-T123 - Verify User is able to search for DB types, Env and Cluster @qan',
  async ({ I, queryAnalyticsPage }) => {
    const filters = [
      'Environment',
      'Cluster',
      'Replication Set',
      'Database',
      'Schema',
      'Node Name',
      'Service Name',
      'Client Host',
      'User Name',
      'Service Type',
      'Application Name',
      'Command Type',
    ];

    await I.waitForElement(queryAnalyticsPage.filters.fields.filterBy, 30);
    const countBefore = await queryAnalyticsPage.data.getCountOfItems();

    for await (const value of filters) {
      queryAnalyticsPage.waitForLoaded();
      const countFilters = await I.grabNumberOfVisibleElements(queryAnalyticsPage.filters.fields.filterCheckBoxesInGroup(value));
      const randomFilterValue = Math.floor(Math.random() * countFilters) + 1;

      queryAnalyticsPage.filters.selectContainsFilterInGroupAtPosition(value, randomFilterValue);
      queryAnalyticsPage.waitForLoaded();
      queryAnalyticsPage.data.waitForNewItemsCount(countBefore);
      const countAfter = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(countBefore !== countAfter, 'Query count was expected to change');

      I.click(queryAnalyticsPage.filters.buttons.resetAll);
      queryAnalyticsPage.waitForLoaded();
    }
  },
);

Scenario(
  'PMM-T191 - Verify Reset All and Show Selected filters @qan',
  async ({ I, queryAnalyticsPage }) => {
    const environmentName1 = 'pxc-dev';
    const environmentName2 = 'dev';

    await queryAnalyticsPage.filters.selectFilter(environmentName1);
    await queryAnalyticsPage.filters.selectFilter(environmentName2);
    await queryAnalyticsPage.filters.showSelectedFilters();
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(2, 'equals');
    await I.click(queryAnalyticsPage.filters.buttons.resetAll);
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(2, 'bigger');

    await queryAnalyticsPage.filters.selectFilter(environmentName1);
    await queryAnalyticsPage.filters.showSelectedFilters();
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(1, 'equals');
    await queryAnalyticsPage.filters.selectFilter(environmentName1);
    await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(1, 'bigger');
  },
);

Scenario('PMM-T190 - Verify user is able to see n/a filter @qan', async ({ I, queryAnalyticsPage }) => {
  await queryAnalyticsPage.waitForLoaded();
  await queryAnalyticsPage.filters.filterBy('n/a');
  await queryAnalyticsPage.filters.verifyCountOfFiltersDisplayed(0, 'bigger');
});

Scenario(
  'PMM-T390 - Verify that we show info message when empty result is returned @qan',
  async ({
    I, adminPage, queryAnalyticsPage,
  }) => {
    const serviceName = 'ps_pmm_';
    const db1 = 'postgres';
    const db2 = 'n/a';
    const section = 'Database';

    let count = queryAnalyticsPage.data.getCountOfItems();

    await adminPage.applyTimeRange('Last 3 hour');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.applyShowAllLinkIfItIsVisible(section);
    queryAnalyticsPage.filters.selectFilterInGroup(db1, section);
    count = queryAnalyticsPage.data.waitForNewItemsCount(count);
    await queryAnalyticsPage.filters.applyShowAllLinkIfItIsVisible(section);
    queryAnalyticsPage.filters.selectFilterInGroup(db2, section);
    count = queryAnalyticsPage.data.waitForNewItemsCount(count);
    queryAnalyticsPage.filters.selectContainFilter(serviceName);
    queryAnalyticsPage.data.waitForNewItemsCount(count);
    queryAnalyticsPage.filters.selectFilterInGroup(db2, section);
    await within(queryAnalyticsPage.data.root, () => {
      I.waitForText('No queries available for this combination of filters', 30);
    });
  },
).retry(2);

Scenario(
  'PMM-T221 - Verify that all filter options are always visible (but some disabled) after selecting an item and % value is changed @qan',
  async ({
    I, adminPage, queryAnalyticsPage,
  }) => {
    const serviceType = 'mysql';
    const serviceName = 'ps_pmm_';

    await adminPage.applyTimeRange('Last 2 days');
    queryAnalyticsPage.waitForLoaded();

    const countQueryAnalyticsBefore = await queryAnalyticsPage.data.getCountOfItems();
    const percentageBefore = await queryAnalyticsPage.filters.getFilterPercentage('Service Type', serviceType);
    const countOfFiltersBefore = await I.grabNumberOfVisibleElements(queryAnalyticsPage.filters.fields.filterCheckboxes);

    queryAnalyticsPage.filters.selectFilter(serviceType);
    queryAnalyticsPage.waitForLoaded();
    const countQueryAnalyticsAfter = await queryAnalyticsPage.data.getCountOfItems();

    I.assertTrue(countQueryAnalyticsAfter !== countQueryAnalyticsBefore, 'Query count was expected to change');
    const countOfFiltersAfter = await I.grabNumberOfVisibleElements(queryAnalyticsPage.filters.fields.filterCheckboxes);

    I.assertEqual(countOfFiltersBefore, countOfFiltersAfter, 'Count of all available filters should not change when filter is selected.');
    queryAnalyticsPage.filters.selectContainFilter(serviceName);
    queryAnalyticsPage.waitForLoaded();
    const percentageAfter = await queryAnalyticsPage.filters.getFilterPercentage('Service Type', serviceType);

    I.assertTrue(percentageAfter !== percentageBefore, 'Percentage for filter Service Type was expected to change');
  },
);
/** Time Range Bug.
Data(shortCutTests).Scenario(
  'PMM-T436 PMM-T458 - Verify short-cut navigation from filters to related dashboards, '
    + 'Verify time interval is passed from QAN to dashboards via shortcut links @qan @debug',
  async ({
    I, dashboardPage, current, adminPage, anPage,
  }) => {
    const shortCutLink = current.shortcutLink;
    const header = current.dashboard;
    const filterValue = current.filter;
    const timeRangeValue = 'from=now-3h&to=now';

    I.amOnPage(`${anPage.url}&orgId=1`);
    await adminPage.applyTimeRange('Last 3 hours');
    anOverview.waitForOverviewLoaded();
    anFilters.waitForFiltersToLoad();

    I.fillField(anFilters.fields.filterBy, filterValue);
    await anFilters.verifyShortcutAttributes(shortCutLink, filterValue, timeRangeValue);

    I.amOnPage(shortCutLink);
    if (filterValue === 'pmm-server') {
      I.waitInUrl(shortCutLink.split('?var-')[0], 30);
      I.waitInUrl(shortCutLink.split('?var-')[1], 30);
    } else {
      I.waitInUrl(shortCutLink, 30);
    }

    await dashboardPage.checkNavigationBar(header);
  },
);
*/
Scenario('PMM-T437 - Verify short-cut navigation for n/a items @qan', async ({ I, queryAnalyticsPage }) => {
  queryAnalyticsPage.waitForLoaded();
  queryAnalyticsPage.filters.checkLink('pxc-dev-cluster', 'Cluster', true);
  queryAnalyticsPage.filters.filterBy('n/a');
  queryAnalyticsPage.filters.checkLink('undefined', 'Cluster', false);
  queryAnalyticsPage.filters.checkLink('undefined', 'Replication Set', false);
});

Scenario('PMM-T2032 - Verify there is no name with brackets in Plan Summary in QAN @qan', async ({ I, queryAnalyticsPage, adminPage }) => {
  queryAnalyticsPage.waitForLoaded();
  queryAnalyticsPage.filters.filterBy('{');
  queryAnalyticsPage.waitForLoaded();

  if (await I.isElementDisplayed(queryAnalyticsPage.filters.fields.filterCheckboxes, 2)) {
    throw new Error('Filter with character "{" displayed');
  }

  adminPage.customClearField(queryAnalyticsPage.filters.fields.filterBy);
  queryAnalyticsPage.waitForLoaded();
  queryAnalyticsPage.filters.filterBy('}');
  queryAnalyticsPage.waitForLoaded();

  if (await I.isElementDisplayed(queryAnalyticsPage.filters.fields.filterCheckboxes, 2)) {
    throw new Error('Filter with character "}" displayed');
  }
});
