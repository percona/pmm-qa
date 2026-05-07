const assert = require('assert');
const { SERVICE_TYPE } = require('./helper/constants');

const { remoteInstancesPage } = inject();

Feature('Monitoring AWS RDS MySQL DB');

Before(async ({ I }) => {
  await I.Authorize();
});

const instances = new DataTable(['instance', 'instanceType']);

instances.add(['mysql57', 'mysql']);
instances.add(['mysql80', 'mysql']);
instances.add(['mysql84', 'mysql']);

// Mapping here to avoid datatables to add those details to test names in allure report
const remoteInstance = {
  mysql57: remoteInstancesPage.mysql57rds,
  mysql80: remoteInstancesPage.mysql80rds,
  mysql84: remoteInstancesPage.mysql84rds,
};

function getInstance(key) {
  return remoteInstance[key];
}

Data(instances).Scenario(
  'PMM-T138 + PMM-T139 - Verify disabling enhanced metrics for RDS, Verify disabling basic metrics for RDS, PMM-T9 Verify adding RDS instances [critical] @instances',
  async ({
    I, current, remoteInstancesPage,
  }) => {
    const {
      instance, instanceType,
    } = current;

    const instanceIdToMonitor = getInstance(instance)['Service Name'];
    const nodeName = 'pmm-server';

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.verifyInstanceIsDiscovered(instanceIdToMonitor);
    remoteInstancesPage.startMonitoringOfInstance(instanceIdToMonitor);
    remoteInstancesPage.verifyAddInstancePageOpened();
    await remoteInstancesPage.fillRemoteRDSFields(instanceIdToMonitor, nodeName);
    await remoteInstancesPage.createRemoteInstance(instanceIdToMonitor);

    // Waiting for metrics to start hitting for remotely added services
    I.wait(60);
  },
);

Data(instances).Scenario(
  'PMM-T138 + PMM-T139 - Verify disabling enhanced metrics for RDS, Verify disabling basic metrics for RDS, PMM-T9 Verify adding RDS instances has Status Running [critical] @instances',
  async ({
    I, pmmInventoryPage, current,
  }) => {
    const {
      instance,
    } = current;

    const instanceIdToMonitor = getInstance(instance)['Service Name'];

    I.amOnPage(pmmInventoryPage.url);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(instanceIdToMonitor);
    await pmmInventoryPage.verifyAgentHasStatusRunning(instanceIdToMonitor);
    // Waiting for metrics to start hitting PMM-Server
    I.wait(20);
  },
).retry(2);

// PMM-13750 Unable to add RDS instance on multiple nodes
Scenario.skip(
  'PMM-13166 + PMM-13548 - Verify adding RDS instances (Verify Ability to monitor DBs from a different node) [critical] @instances',
  async ({ I, remoteInstancesPage, pmmInventoryPage }) => {
    const instanceIdToMonitor = remoteInstancesPage.mysql57rds['Service Name'];
    const nodeName = 'client_container';

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.verifyInstanceIsDiscovered(instanceIdToMonitor);
    remoteInstancesPage.startMonitoringOfInstance(instanceIdToMonitor);
    remoteInstancesPage.verifyAddInstancePageOpened();
    await remoteInstancesPage.fillRemoteRDSFields(instanceIdToMonitor, nodeName);
    await remoteInstancesPage.createRemoteInstance(instanceIdToMonitor);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(instanceIdToMonitor);
    await pmmInventoryPage.verifyNodeAgentHasRDSExporter(instanceIdToMonitor);

    // Waiting for metrics to start hitting for remotely added services
    I.wait(60);
  },
);

// bug about failing error message https://jira.percona.com/browse/PMM-9301
xScenario(
  'Verify RDS allows discovery without credentials @instances',
  async ({ I, remoteInstancesPage }) => {
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDSWithoutCredentials();
  },
).retry(1);

// Skipping the tests because QAN does not get any data right after instance was added for monitoring
xScenario(
  'Verify QAN Filters contain AWS RDS MySQL 5.6 after it was added for monitoring @instances',
  async ({
    I, queryAnalyticsPage, remoteInstancesPage,
  }) => {
    const filters = remoteInstancesPage.mysql57rds;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    for (const filter of Object.values(filters)) {
      I.waitForVisible(queryAnalyticsPage.filters.filterByName(filter), 30);
      I.seeElement(queryAnalyticsPage.filters.filterByName(filter));
    }
  },
);

Data(instances).Scenario(
  'Verify MySQL Instances Overview Dashboard for AWS RDS MySQL data after it was added for monitoring @instances',
  async ({ I, current, dashboardPage }) => {
    const {
      instance,
    } = current;

    const instanceIdToMonitor = getInstance(instance);

    // Add wait for metrics to appear
    await I.wait(60);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, {
      cluster: instanceIdToMonitor.Cluster,
      from: 'now-5m',
    }));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(9);
  },
).retry(3);

Data(instances).Scenario(
  'Verify MySQL Instances Overview Dashboard contains AWS RDS MySQL filters @instances',
  async ({
    I, current, dashboardPage,
  }) => {
    const {
      instance,
    } = current;

    const filters = getInstance(instance);

    I.amOnPage(dashboardPage.mySQLInstanceOverview.url);
    dashboardPage.waitForDashboardOpened();
    for (const key of Object.keys(filters)) {
      dashboardPage.expandFilters(key);
      I.click(dashboardPage.fields.openFiltersDropdownLocator(key));
      I.waitForVisible(dashboardPage.fields.filterDropdownValueLocator(filters[key]), 5);
      I.pressKey('Escape');
    }
  },
);

Data(instances).Scenario(
  'PMM-T603 - Verify MySQL RDS exporter is running in pull mode @instances',
  async ({
    grafanaAPI, inventoryAPI, current,
  }) => {
    const {
      instance,
    } = current;

    const metricNames = ['aws_rds_cpu_credit_usage_average', 'rdsosmetrics_memory_total', 'rdsosmetrics_cpuUtilization_total'];
    const serviceName = getInstance(instance)['Service Name'];
    const { node_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, serviceName);
    const response = await inventoryAPI.apiGetAgentsViaNodeId(node_id);
    const result = response.data.rds_exporter[0];

    assert.ok(!result.push_metrics_enabled, `Push Metrics Enabled Flag Should not be present on response object for AWS RDS but found ${JSON.stringify(result)}`);
    for (const metric of metricNames) {
      await grafanaAPI.waitForMetric(metric, { type: 'node_id', value: node_id });
    }
  },
);
