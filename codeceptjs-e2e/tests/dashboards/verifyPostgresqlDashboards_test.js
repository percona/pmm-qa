const { inventoryAPI } = inject();

Feature('Test Dashboards inside the PostgreSQL Folder').retry(2);

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T2050 - Verify PostgreSQL Instance Summary Dashboard @nightly @dashboard-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*$');
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
  'PMM-T2049 - Verify PostgreSQL Instances Overview Dashboard @nightly @dashboard-pdpgsql @dashboard-pgsql @dashboards',
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
  'PMM-T394 - PostgreSQL Instance Compare Dashboard metrics @nightly @dashboard-pgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstanceCompareDashboard.cleanUrl, {
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlInstanceCompareDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2044 - Verify PostgreSQL Top Queries Dashboard metrics @nightly @dashboard-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*$');
    const url = I.buildUrlWithParams(dashboardPage.postgresqlTopQueriesDashboard.url, { from: 'now-12h', service_name });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlTopQueriesDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2048 - Verify PostgreSQL Instances Overview Extended metrics @nightly @dashboard-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const { service_name } = await inventoryAPI.getServiceDetailsByRegex('pdpgsql_pmm_.*$');
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstancesOverviewExtendedDashboard.url, {
      from: 'now-30m',
      service_name,
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlInstancesOverviewExtendedDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2052 - Verify PostgreSQL Checkpoints, Buffers and WAL Usage dashboard @nightly @dashboard-patroni-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const details = (await inventoryAPI.getNodeByServiceName('patroni_service_1')).services.find((service) => service.service_name.includes('pdpgsql_pmm_patroni'));
    const url = I.buildUrlWithParams(dashboardPage.postgresqlCheckpointDashboard.url, {
      from: 'now-5m',
      service_name: details.service_name,
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlCheckpointDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2051 - Verify PostgreSQL Replication Overview dashboard @nightly @dashboard-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlReplicationOverviewDashboard.url, { from: 'now-1h' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlReplicationOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'PMM-T2053 - Verify PostgreSQL Patroni Details dashboard @nightly @dashboard-patroni-pdpgsql @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlPatroniDashboard.url, { from: 'now-5m' });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.postgresqlPatroniDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);
