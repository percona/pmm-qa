const assert = require('assert');
const { SERVICE_TYPE } = require('./helper/constants');

const { remoteInstancesPage, remoteInstancesHelper } = inject();

const filters = new DataTable(['filter']);
const azureServices = new DataTable(['name', 'instanceToMonitor']);

if (remoteInstancesHelper.getInstanceStatus('azure').azure_mysql.enabled) {
  azureServices.add(['azure-MySQL', 'pmm2-qa-mysql']);
  filters.add([remoteInstancesPage.mysqlAzureInputs.environment]);
}

if (remoteInstancesHelper.getInstanceStatus('azure').azure_postgresql.enabled) {
  azureServices.add(['azure-PostgreSQL', 'pmm2-qa-postgresql']);
  filters.add([remoteInstancesPage.postgresqlAzureInputs.environment]);
}

const metrics = new DataTable(['metricName']);

metrics.add(['azure_memory_percent_average']);
metrics.add(['mysql_global_status_max_used_connections']);
// Removing to avoid failures due to missing metric, seems to be some changes on Azure deployments.
// metrics.add(['mysql_global_variables_azure_ia_enabled']);

Feature('Monitoring Azure MySQL and PostgreSQL DB');

Before(async ({ I }) => {
  await I.Authorize();
});

Data(azureServices).Scenario(
  'PMM-T744 + PMM-T746 + PMM-T748 - Verify adding monitoring for Azure @instances',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, settingsAPI, current, inventoryAPI,
  }) => {
    const serviceName = current.name;
    const nodeName = 'pmm-server';

    await settingsAPI.enableAzure();
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.openAddAzure();
    remoteInstancesPage.discoverAzure();
    remoteInstancesPage.startMonitoringOfInstance(current.instanceToMonitor);
    remoteInstancesPage.verifyAddInstancePageOpened();
    await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);

    if (serviceName === 'azure-MySQL') {
      await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
        {
          serviceType: SERVICE_TYPE.MYSQL,
          service: 'mysql',
        },
        serviceName,
      );
    } else {
      await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
        {
          serviceType: SERVICE_TYPE.POSTGRESQL,
          service: 'postgresql',
        },
        serviceName,
      );
    }

    // await pmmInventoryPage.verifyAgentHasStatusRunning(serviceName);
  },
);

// Skip Due to changes Home Dashboard
xScenario(
  'PMM-T756 - Verify Azure node is displayed on Home dashboard @instances',
  async ({ I, homePage }) => {
    const nodeName = 'azure-MySQL';

    I.amOnPage(I.buildUrlWithParams(homePage.cleanUrl, {
      node_name: nodeName,
      from: 'now-5m',
    }));
    homePage.verifyVisibleService(nodeName);
    // part without RDS MySQL should be skipped for now
  },
).retry(2);

Data(filters).Scenario('PMM-T746, PMM-T748 - Verify adding monitoring for Azure CHECK QAN @instances', async ({
  I, current, queryAnalyticsPage,
}) => {
  I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m', refresh: '5s' }));
  await queryAnalyticsPage.filters.selectFilter(current.filter);
  queryAnalyticsPage.waitForLoaded();
  const count = await queryAnalyticsPage.data.getCountOfItems();

  assert.ok(count > 0, `QAN queries for added Azure service with env as ${current.filter} do not exist`);
}).retry(1);

Data(metrics).Scenario(
  'PMM-T743 - Check metrics from exporters are hitting PMM Server @instances',
  async ({ grafanaAPI, current }) => {
    await grafanaAPI.waitForMetric(current.metricName, null, 10);
  },
).retry(1);
