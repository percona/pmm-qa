const { SERVICE_TYPE } = require('../helper/constants');

const { inventoryAPI } = inject();
const serviceList = [];

Feature('Test Dashboards inside the PostgreSQL Folder');

BeforeSuite(async ({ I }) => {
  const pdpgsql_service_response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pdpgsql_');
  const pgsql_service_response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pgsql_');
  const pmm_server = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pmm-server-postgresql');

  serviceList.push(pdpgsql_service_response.service_name);
  serviceList.push(pgsql_service_response.service_name);
  serviceList.push(pmm_server.service_name);
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T2050 - Verify PostgreSQL Instance Summary Dashboard @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByStartsWithName('pdpgsql_pgsm_pmm_');
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, { service_name, from: 'now-1h' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifySlowQueriesPanel('60 minutes');
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2049 - Verify PostgreSQL Instances Overview Dashboard @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstanceOverviewDashboard.url, { from: 'now-5m' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifySlowQueriesPanel('5 minutes');
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T394 - PostgreSQL Instance Compare Dashboard metrics @nightly @dashboards',
  async ({ I, dashboardPage, adminPage }) => {
    const url = I.buildUrlWithParams(
      dashboardPage.postgresqlInstanceCompareDashboard.cleanUrl,
      {
        from: 'now-5m',
      },
    );

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlInstanceCompareDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2044 - Verify PostgreSQL Top Queries Dashboard metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByStartsWithName('pdpgsql_pgsm');
    const url = I.buildUrlWithParams(dashboardPage.postgresqlTopQueriesDashboard.url, { from: 'now-5m', service_name });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlTopQueriesDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2048 - Verify PostgreSQL Instances Overview Extended metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByStartsWithName('pdpgsql_pgsm');
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstancesOverviewExtendedDashboard.url, { from: 'now-30m', service_name });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlInstancesOverviewExtendedDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2052 - Verify PostgreSQL Checkpoints, Buffers and WAL Usage dashboard @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const details = (await inventoryAPI.getNodeByServiceName('patroni_service_1')).services.find((service) => service.service_name.includes('pdpgsql_pmm_patroni'));
    const url = I.buildUrlWithParams(dashboardPage.postgresqlCheckpointDashboard.url, { from: 'now-5m', service_name: details.service_name });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlCheckpointDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2051 - Verify PostgreSQL Replication Overview dashboard @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlReplicationOverviewDashboard.url, { from: 'now-5m' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlReplicationOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2053 - Verify PostgreSQL Patroni Details dashboard @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlPatroniDashboard.url, { from: 'now-5m' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlPatroniDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);
