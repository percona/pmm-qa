const assert = require('assert');

const { adminPage } = inject();
const replicationSet = 'ps-async-replication';
const serviceList = [
  { serviceName: '_1' },
  { serviceName: '_2' },
];

Feature('Integration tests for Percona Server (Replica) & PMM').retry(1);

Before(async ({ I }) => {
  await I.Authorize();
});

Data(serviceList).Scenario(
  'PMM-T2029 - Verify dashboard for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly',
  async ({
    I, dashboardPage, adminPage, inventoryAPI, current,
  }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByPartialDetails(
      {
        service_name: current.serviceName,
        replication_set: replicationSet,
      },
    );

    const url = I.buildUrlWithParams(dashboardPage.mysqlReplcationDashboard.clearUrl, {
      from: 'now-5m', to: 'now', service_name, refresh: '5s',
    });

    I.amOnPage(url);
    await dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyMetricsExistence(dashboardPage.mysqlReplcationDashboard.metrics);
    if (current.serviceName === '_1') {
      await dashboardPage.verifyThereAreNoGraphsWithoutData(9);
    } else {
      await dashboardPage.verifyThereAreNoGraphsWithoutData(4);
    }
  },
);

Scenario(
  'PMM-T2030 - Verify QAN for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly',
  async ({
    I, queryAnalyticsPage, inventoryAPI,
  }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByPartialDetails(
      {
        service_name: '_1',
        replication_set: replicationSet,
      },
    );

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m', refresh: '5s' }));
    queryAnalyticsPage.waitForLoaded();
    await adminPage.applyTimeRange('Last 12 hours');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup(replicationSet, 'Replication Set');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup(service_name, 'Service Name');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup('sbtest', 'Schema');
    queryAnalyticsPage.waitForLoaded();

    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${service_name} instance do NOT exist, check QAN Data`);
  },
);
