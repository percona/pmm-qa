const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('MongoDB Tests after PMM migration to V3');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1978 - Verify MongoDB dashboard after PMM migration to V3 @not-ui-pipeline @pmm-migration',
  async ({
    I, dashboardPage, adminPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'rs101')).service_name;
    let url = I.buildUrlWithParams(dashboardPage.mongoDbInstanceOverview.url, {
      from: 'now-5m',
      to: 'now',
      service_name: clientServiceName,
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(3);

    url = I.buildUrlWithParams(dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, { from: 'now-5m' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(4);

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus({
      serviceType: SERVICE_TYPE.MONGODB,
      service: 'mongodb',
    }, clientServiceName);
  },
).retry(1);

Scenario(
  'PMM-T1979 - Verify MongoDB QAN after PMM migration to V3 @not-ui-pipeline @pmm-migration',
  async ({
    I, queryAnalyticsPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, 'rs101')).service_name;

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
