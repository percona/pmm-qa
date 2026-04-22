const assert = require('assert');
const { NODE_TYPE, SERVICE_TYPE } = require('./helper/constants');

const { remoteInstancesHelper, pmmInventoryPage } = inject();

Feature('Monitoring Aurora MySQL instances');

Before(async ({ I }) => {
  await I.Authorize();
});

const instances = ['mysqlaurora3'];
const mysql_metric = 'mysql_global_status_max_used_connections';
const aurora_metric = 'mysql_global_status_auroradb_commit_latency';

Before(async ({ I }) => {
  await I.Authorize();
});

Data(instances).Scenario('PMM-T1295 - Verify adding Aurora MySQL remote instance @instances', async ({
  I, addInstanceAPI, inventoryAPI, current,
}) => {
  const details = {
    add_node: {
      node_name: remoteInstancesHelper.remote_instance.aws.aurora[current].address,
      node_type: NODE_TYPE.REMOTE,
    },
    aws_access_key: remoteInstancesHelper.remote_instance.aws.aurora.aws_access_key,
    aws_secret_key: remoteInstancesHelper.remote_instance.aws.aurora.aws_secret_key,
    address: remoteInstancesHelper.remote_instance.aws.aurora[current].address,
    service_name: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
    port: remoteInstancesHelper.remote_instance.aws.aurora.port,
    username: remoteInstancesHelper.remote_instance.aws.aurora.username,
    password: remoteInstancesHelper.remote_instance.aws.aurora[current].password,
    instance_id: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
    cluster_name: remoteInstancesHelper.remote_instance.aws.aurora[current].cluster_name,
  };

  await addInstanceAPI.addRDS(details.service_name, details);

  I.amOnPage(pmmInventoryPage.url);
  pmmInventoryPage.verifyRemoteServiceIsDisplayed(details.service_name);
  await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
    {
      serviceType: SERVICE_TYPE.MYSQL,
      service: 'mysql',
    },
    details.service_name,
  );

  // Waiting for metrics to start hitting for remotely added services
  I.wait(60);
  // await pmmInventoryPage.verifyAgentHasStatusRunning(details.service_name);
});

Data(instances).Scenario('PMM-T1295 - Verify Aurora MySQL instance metrics @instances', async ({ I, current, grafanaAPI }) => {
  I.wait(10);

  await grafanaAPI.checkMetricExist(mysql_metric, {
    type: 'service_name',
    value: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
  });

  await grafanaAPI.checkMetricExist(aurora_metric, {
    type: 'service_name',
    value: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
  });
}).retry(1);

Data(instances).Scenario('PMM-T1295 - Verify MySQL Amazon Aurora Details @instances', async ({ I, dashboardPage, current }) => {
  // Waiting for metrics to start hitting for remotely added services
  I.wait(60);
  I.amOnPage(I.buildUrlWithParams(dashboardPage.mysqlAmazonAuroraDetails.url, {
    service_name: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
    from: 'now-5m',
  }));
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
}).retry(3);

Data(instances).Scenario('PMM-T1295 - Verify dashboard after Aurora MySQL instance is added @instances', async ({
  I, dashboardPage, adminPage, current,
}) => {
  // Waiting for metrics to start hitting for remotely added services
  I.wait(60);
  I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, {
    from: 'now-5m',
    service_name: remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id,
  }));
  dashboardPage.waitForDashboardOpened();
  adminPage.performPageDown(5);
  await dashboardPage.expandEachDashboardRow();
  adminPage.performPageUp(5);
  await dashboardPage.verifyThereAreNoGraphsWithoutData(8);
}).retry(3);

Data(instances).Scenario(
  'PMM-T1295 - Verify QAN after Aurora MySQL instance is added @instances',
  async ({
    I, queryAnalyticsPage, current,
  }) => {
    const { instance_id } = remoteInstancesHelper.remote_instance.aws.aurora[current];

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(instance_id);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${instance_id} instance do NOT exist, check QAN Data`);
  },
).retry(1);
