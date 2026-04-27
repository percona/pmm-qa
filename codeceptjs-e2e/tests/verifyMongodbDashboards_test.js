const { isJenkinsGssapiJob } = require('./helper/constants');

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
    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongoDbShardedClusterSummary.url, {
      cluster: 'sharded',
      from: 'now-5m',
    }));

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
    I, dashboardPage, inventoryAPI, adminPage,
  }) => {
    const mongoService = await inventoryAPI.getServiceDetailsByPartialDetails({ cluster: 'replicaset', service_name: 'rs101' });

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongoDbCollectionsOverview.clearUrl, {
      from: 'now-5m',
      node_name: mongoService.node_name,
      refresh: '5s',
    }));
    dashboardPage.waitForDashboardOpened();
    await adminPage.performPageDown(5);
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongoDbCollectionsOverview.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
  },
).retry(2);

const fcvPanelTestData = () => {
  const { dashboardPage } = inject();
  let dashboards = [
    { url: dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, cluster: 'replicaset' },
    { url: dashboardPage.mongoDbShardedClusterSummary.url, cluster: 'sharded' },
  ];

  if (isJenkinsGssapiJob) {
    dashboards = dashboards.filter((item) => item.cluster !== 'sharded');
  }

  return dashboards;
};

Data(fcvPanelTestData()).Scenario(
  'PMM-T2035 - Verify MongoDb Cluster and MongoDB ReplSet dashboards has FCV panel @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage, current }) => {
    const url = I.buildUrlWithParams(current.url, {
      from: 'now-5m',
      cluster: current.cluster,
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    const fcvVersion = await I.grabTextFrom(dashboardPage.panelValueByTitle('Feature Compatibility Version'));
    const mongodbVersion = process.env.PSMDB_VERSION || '8.0';

    I.assertEqual(
      fcvVersion,
      mongodbVersion.split('.')[0],
      'Feature Compatibility Version is not correct.',
    );
  },
);

Scenario('PMM-T2003 - Verify that MongoDB Compare dashboard has Cluster, Replication, Node filters @nightly', async ({
  I, dashboardPage, inventoryAPI,
}) => {
  const newClusterName = 'replicaset';
  const newEnvironmentName = 'psmdb-dev';
  const mongoServices = (await inventoryAPI.getServiceListDetailsByPartialDetails({ environment: newEnvironmentName }))
    .map((service) => service.service_name);

  I.amOnPage(I.buildUrlWithParams(dashboardPage.mongodbInstancesCompareDashboard.url, { from: 'now-5m' }));

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
});
