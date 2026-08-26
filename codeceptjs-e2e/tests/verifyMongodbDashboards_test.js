Feature('Test Dashboards inside the MongoDB Folder');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T305 - Open the MongoDB Instance Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.mongodbOverviewDashboard.url, {
      from: 'now-5m',
      cluster: 'replicaset',
      refresh: '5s',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongodbOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

Scenario(
  'Open the MongoDB Cluster Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    I.amOnPage(
      I.buildUrlWithParams(dashboardPage.mongoDbShardedClusterSummary.url, {
        cluster: 'sharded',
        from: 'now-5m',
        refresh: '5s',
      }),
    );

    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongoDbShardedClusterSummary.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(9);
  },
);

Scenario(
  'PMM-T1698 - Verify that Disk I/O and Swap Activity and Network Traffic panels have graphs if Node name contains dot symbol @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, {
      from: 'now-5m',
      cluster: 'replicaset',
      refresh: '5s',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.mongodbReplicaSetSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(6);
  },
);

Scenario(
  'PMM-T1333 - Verify MongoDB - MongoDB Collections Overview @mongodb-exporter @nightly @gssapi-nightly',
  async ({
    I, dashboardPage, inventoryAPI, adminPage, grafanaAPI,
  }) => {
    const mongoService = await inventoryAPI.getServiceDetailsByPartialDetails({ cluster: 'replicaset', service_name: 'rs101' });

    // Wait for the service's metrics before loading the dashboard, not after: Grafana
    // resolves $database and $replication_set once, at page load, and never re-resolves
    // them on refresh, so a dashboard opened before the first scrape keeps empty
    // variables - and empty panels - for the rest of the test. mongodb_dbstats_* needs
    // its own wait because PMM collects it on the exporter's low-resolution (1m) job,
    // up to a minute behind the 5s job every other panel here reads.
    await grafanaAPI.waitForMetric('mongodb_top_commands_count', { type: 'service_name', value: mongoService.service_name }, 120);
    await grafanaAPI.waitForMetric('mongodb_dbstats_dataSize', { type: 'service_name', value: mongoService.service_name }, 120);

    I.amOnPage(
      I.buildUrlWithParams(dashboardPage.mongoDbCollectionsOverview.clearUrl, {
        from: 'now-5m',
        node_name: mongoService.node_name,
        service_name: mongoService.service_name,
        refresh: '5s',
      }),
    );
    dashboardPage.waitForDashboardOpened();
    await adminPage.performPageDown(5);
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongoDbCollectionsOverview.metrics);
    await dashboardPage.waitForGraphsToHaveData(2, 60);
  },
);

Scenario(
  'PMM-T2035 - Verify MongoDB ReplSet dashboard has FCV panel @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, {
      from: 'now-5m',
      cluster: 'replicaset',
      refresh: '5s',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    const fcvVersion = await I.grabTextFrom(dashboardPage.panelValueByTitle('Feature Compatibility Version'));
    const mongodbVersion = process.env.PSMDB_VERSION || '8.0';

    I.assertEqual(fcvVersion, mongodbVersion.split('.')[0], 'Feature Compatibility Version is not correct.');
  },
);

Scenario('PMM-T2035 - Verify MongoDB Cluster dashboard has FCV panel @nightly @dashboards', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.mongoDbShardedClusterSummary.url, {
    from: 'now-5m',
    cluster: 'sharded',
    refresh: '5s',
  });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  const fcvVersion = await I.grabTextFrom(dashboardPage.panelValueByTitle('Feature Compatibility Version'));
  const mongodbVersion = process.env.PSMDB_VERSION || '8.0';

  I.assertEqual(fcvVersion, mongodbVersion.split('.')[0], 'Feature Compatibility Version is not correct.');
});

Scenario(
  'PMM-T2003 - Verify that MongoDB Compare dashboard has Cluster, Replication, Node filters @nightly',
  async ({ I, dashboardPage, inventoryAPI }) => {
    const newClusterName = 'replicaset';
    const newEnvironmentName = 'psmdb-dev';
    const mongoServices = (await inventoryAPI.getServiceListDetailsByPartialDetails({ environment: newEnvironmentName })).map(
      (service) => service.service_name,
    );

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongodbInstancesCompareDashboard.url, { from: 'now-5m', refresh: '5s' }));

    dashboardPage.mongodbInstancesCompareDashboard.selectEnvironment(newEnvironmentName);
    dashboardPage.mongodbInstancesCompareDashboard.verifyServicesInfoPanelDisplayed(mongoServices);
    dashboardPage.mongodbInstancesCompareDashboard.unselectEnvironment();

    dashboardPage.mongodbInstancesCompareDashboard.selectCluster(newClusterName);
    dashboardPage.mongodbInstancesCompareDashboard.verifyServicesInfoPanelDisplayed(mongoServices);
    dashboardPage.mongodbInstancesCompareDashboard.unselectCluster();

    dashboardPage.mongodbInstancesCompareDashboard.selectReplicationSet('rs');
    I.waitInUrl('&var-replication_set=rs', 2);
    dashboardPage.mongodbInstancesCompareDashboard.unselectReplicationSet();

    dashboardPage.mongodbInstancesCompareDashboard.selectNode([mongoServices[0]]);
    dashboardPage.mongodbInstancesCompareDashboard.verifyServicesInfoPanelDisplayed([mongoServices[0]]);
  },
);
