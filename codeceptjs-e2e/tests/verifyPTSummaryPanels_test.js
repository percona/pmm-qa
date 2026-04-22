const { SERVICE_TYPE } = require('./helper/constants');

Feature('PT Summary');
Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T672 - Verify summary for MongoDB is displayed on Instance Summary dashboard @dashboards @nightly',
  async ({
    I, dashboardPage, inventoryAPI,
  }) => {
    const psmdb_service_response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, 'rs101');
    const url = I.buildUrlWithParams(
      dashboardPage.mongoDbInstanceSummaryDashboard.url,
      { service_name: psmdb_service_response.service_name, from: 'now-5m' },
    );

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    I.waitForVisible(dashboardPage.fields.serviceSummary, 30);
    I.click(dashboardPage.fields.serviceSummary);
    I.waitForVisible(dashboardPage.fields.mongoDBServiceSummaryContent, 150);
  },
).retry(1);

Scenario(
  'PMM-T671 + PMM-T666 + PMM-T672 - Verify summary for PS is displayed on Instance Summary dashboard @dashboards @nightly',
  async ({
    I, dashboardPage, inventoryAPI,
  }) => {
    const ps_service_response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, 'ps_pmm');
    const url = I.buildUrlWithParams(
      dashboardPage.mysqlInstanceSummaryDashboard.clearUrl,
      { service_name: ps_service_response.service_name, from: 'now-15m' },
    );

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    I.waitForVisible(dashboardPage.fields.serviceSummary, 30);
    I.click(dashboardPage.fields.serviceSummary);
    I.waitForVisible(dashboardPage.fields.mySQLServiceSummaryContent, 150);
  },
).retry(1);

Scenario(
  'PMM-T666 - Verify summary for PG is displayed on Instance Summary dashboard @dashboards @nightly',
  async ({
    I, dashboardPage, inventoryAPI, adminPage,
  }) => {
    const pgsql_service_response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pgsql_');
    const url = I.buildUrlWithParams(
      dashboardPage.postgresqlInstanceSummaryDashboard.url,
      { service_name: pgsql_service_response.service_name, from: 'now-15m' },
    );

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await adminPage.performPageDown(5);
    I.waitForVisible(dashboardPage.fields.serviceSummary, 30);
    I.click(dashboardPage.fields.serviceSummary);
    I.waitForVisible(dashboardPage.fields.postgreSQLServiceSummaryContent, 150);
  },
).retry(1);
