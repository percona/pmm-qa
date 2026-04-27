const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('Integration tests for Percona Server & PMM');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1982 - Verify Percona Server dashboard after PMM migration to V3 @not-ui-pipeline @pmm-migration',
  async ({
    I, dashboardPage, adminPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'ps_8')).service_name;

    const url = I.buildUrlWithParams(dashboardPage.mysqlInstanceSummaryDashboard.clearUrl, { from: 'now-5m', to: 'now', service_name: clientServiceName });

    I.amOnPage(url);
    await dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(6);

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus({
      serviceType: SERVICE_TYPE.MYSQL,
      service: 'mysql',
    }, clientServiceName);
  },
).retry(2);

Scenario(
  'PMM-T1983 - Verify QAN have data for Percona Server after PMM migration to V3 @not-ui-pipeline @pmm-migration',
  async ({
    I, queryAnalyticsPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'ps_8')).service_name;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-30m', to: 'now-10m', service_name: clientServiceName }));
    queryAnalyticsPage.waitForLoaded();
    const countBeforeMigration = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countBeforeMigration > 0, `The queries for service ${clientServiceName} instance do NOT exist, check QAN Data`);

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m', service_name: clientServiceName }));
    queryAnalyticsPage.waitForLoaded();
    const countAfterMigration = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(countAfterMigration > 0, `The queries for service ${clientServiceName} instance do NOT exist, check QAN Data`);
  },
).retry(1);

Scenario(
  'PMM-T2042 - Verify Explain tab for Percona Server is displayed with data after migration @pmm-migration',
  async ({
    I, queryAnalyticsPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'ps_8')).service_name;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, {
      from: 'now-30m', to: 'now-10m', service_name: clientServiceName, search: 'SELECT',
    }));
    queryAnalyticsPage.waitForLoaded();

    await queryAnalyticsPage.data.verifyQueriesDisplayed();
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.queryDetails.verifyExplain();
  },
).retry(1);
