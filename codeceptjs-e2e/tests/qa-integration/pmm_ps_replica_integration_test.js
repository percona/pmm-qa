const assert = require('assert');

const { adminPage } = inject();
const serviceList = [{ serviceName: '_1', replication_set: 'ps-async-replication' }, { serviceName: '_2', replication_set: 'ps-async-replication' }];

Feature('Integration tests for Percona Server (Replica) & PMM').retry(1);

Before(async ({ I }) => {
  await I.Authorize();
});

BeforeSuite(async ({ inventoryAPI }) => {
  serviceList[0].serviceName = (await inventoryAPI.getServiceDetailsByPartialDetails({ service_name: '_1', replication_set: serviceList[0].replication_set })).service_name;
  serviceList[1].serviceName = (await inventoryAPI.getServiceDetailsByPartialDetails({ service_name: '_2', replication_set: serviceList[1].replication_set })).service_name;
});

Data(serviceList).Scenario(
  'PMM-T2029 - Verify dashboard for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly @nightly-pxc-ps-replication',
  async ({
    I, dashboardPage, adminPage, current,
  }) => {
    const url = I.buildUrlWithParams(dashboardPage.mysqlReplcationDashboard.clearUrl, { from: 'now-5m', to: 'now', service_name: current.serviceName });

    I.amOnPage(url);
    await dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyMetricsExistence(dashboardPage.mysqlReplcationDashboard.metrics);
    if (current.serviceName === serviceList[0].serviceName) {
      await dashboardPage.verifyThereAreNoGraphsWithoutData(7);
    } else {
      await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
    }
  },
);

Scenario(
  'PMM-T2030 - Verify QAN for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly @nightly-pxc-ps-replication',
  async ({
    I, queryAnalyticsPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await adminPage.applyTimeRange('Last 12 hours');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup('ps-async-replication', 'Replication Set');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup(serviceList[1].serviceName, 'Service Name');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilterInGroup('sbtest', 'Schema');
    queryAnalyticsPage.waitForLoaded();

    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${serviceList[1].serviceName} instance do NOT exist, check QAN Data`);
  },
);
