const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('Postgres Tests after PMM migration to V3');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1980 - Verify Postgres dashboard after PMM migration to V3 @pmm-migration',
  async ({
    I, dashboardPage, inventoryAPI,
  }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByStartsWithName('PDPGSQL_');

    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, { from: 'now-5m', service_name }));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
    await I.verifyCommand('pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"');
    await I.verifyCommand('pmm-admin list | grep "postgres_exporter" | grep "Running"');

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus({
      serviceType: SERVICE_TYPE.POSTGRESQL,
      service: 'postgresql',
    }, service_name);
  },
).retry(3);

Scenario(
  'PMM-T1981 - Verify QAN for Postgres after PMM migration to V3 @not-ui-pipeline @pmm-migration',
  async ({
    I, queryAnalyticsPage, inventoryAPI,
  }) => {
    const clientServiceName = (await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'PDPGSQL_')).service_name;

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
