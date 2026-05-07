const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('Integration tests for PSMDB & PMM');

Before(async ({ I }) => {
  await I.Authorize();
});

const version = process.env.PSMDB_VERSION ? `${process.env.PSMDB_VERSION}` : '4.4';
const replica_container_name = `psmdb_pmm_${version}_replica`;
const regular_container_name = `psmdb_pmm_${version}_regular`;
const arbiter_primary_container_name = 'rs101';
const remoteServiceName = 'remote_pmm-psmdb-integration';

const connection = {
  host: regular_container_name,
  port: 27017,
  username: 'pmm_mongodb',
  password: 'GRgrO9301RuF',
};

Scenario(
  'Verify Adding MongoDB services remotely @pmm-psmdb-regular-integration @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, inventoryAPI,
  }) => {
    const details = {
      serviceName: remoteServiceName,
      serviceType: SERVICE_TYPE.MONGODB,
      port: '27017',
      username: connection.username,
      password: connection.password,
      host: regular_container_name,
      cluster: 'mongodb_remote_cluster',
      environment: 'mongodb_remote_cluster',
    };

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mongodb');
    I.fillField(remoteInstancesPage.fields.hostName, details.host);
    I.clearField(remoteInstancesPage.fields.portNumber);
    I.fillField(remoteInstancesPage.fields.portNumber, details.port);
    I.fillField(remoteInstancesPage.fields.userName, details.username);
    I.fillField(remoteInstancesPage.fields.serviceName, remoteServiceName);
    I.fillField(remoteInstancesPage.fields.password, details.password);
    I.fillField(remoteInstancesPage.fields.environment, details.environment);
    I.fillField(remoteInstancesPage.fields.cluster, details.cluster);
    I.click(remoteInstancesPage.fields.useQANMongoDBProfiler);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    I.waitForVisible(pmmInventoryPage.fields.agentsLink, 30);
    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MONGODB,
        service: 'mongodb',
      },
      details.serviceName,
    );

    // Check Remote Instance also added and have running status
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(remoteServiceName);
    await pmmInventoryPage.verifyAgentHasStatusRunning(remoteServiceName);
  },
);

Scenario.skip(
  'Verify metrics from PSMDB instances on PMM-Server @pmm-psmdb-replica-integration @not-ui-pipeline',
  async ({
    I, grafanaAPI,
  }) => {
    let response; let result;
    const metricName = 'mongodb_connections';

    await I.verifyCommand(`docker exec ${replica_container_name} pmm-admin list | grep "mongodb_exporter" | grep "Running" | wc -l | grep "3"`);
    await I.verifyCommand(`docker exec ${replica_container_name} pmm-admin list | grep "mongodb_profiler_agent" | grep "Running" | wc -l | grep "3"`);

    const clientServiceName = (await I.verifyCommand(`docker exec ${replica_container_name} pmm-admin list | grep MongoDB | head -1 | awk -F" " '{print $2}'`)).trim();

    // Waiting for metrics to start hitting for remotely added services
    I.wait(10);

    // verify metric for client container node instance
    response = await grafanaAPI.checkMetricExist(metricName, { type: 'service_name', value: clientServiceName });
    result = JSON.stringify(response.data.data.result);

    assert.ok(response.data.data.result.length !== 0, `Metrics ${metricName} from ${clientServiceName} should be available but got empty ${result}`);

    // verify metric for remote instance
    response = await grafanaAPI.checkMetricExist(metricName, { type: 'service_name', value: remoteServiceName });
    result = JSON.stringify(response.data.data.result);

    assert.ok(response.data.data.result.length !== 0, `Metrics ${metricName} from ${remoteServiceName} should be available but got empty ${result}`);
  },
).retry(1);

Scenario.skip(
  'Verify dashboard after MongoDB Instances are added @pmm-psmdb-replica-integration @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    const clientServiceName = (await I.verifyCommand(`docker exec ${replica_container_name} pmm-admin list | grep MongoDB | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      const url = I.buildUrlWithParams(dashboardPage.mongoDbInstanceOverview.url, { from: 'now-5m', to: 'now', service_name: service });

      I.amOnPage(url);
      dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      if (service === remoteServiceName) {
        await dashboardPage.verifyThereAreNoGraphsWithNA(1);
        await dashboardPage.verifyThereAreNoGraphsWithoutData(9);
      } else {
        await dashboardPage.verifyThereAreNoGraphsWithNA();
        await dashboardPage.verifyThereAreNoGraphsWithoutData(3);
      }
    }

    I.amOnPage(`${dashboardPage.mongodbReplicaSetSummaryDashboard.url}&var-replset=rs1`);
    dashboardPage.waitForDashboardOpened();
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyThereAreNoGraphsWithNA();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
  },
).retry(1);

Scenario.skip(
  'Verify QAN after MongoDB Instances is added @pmm-psmdb-replica-integration @not-ui-pipeline',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const clientServiceName = (await I.verifyCommand(`docker exec ${replica_container_name} pmm-admin list | grep MongoDB | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-120m', to: 'now' }));

      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilter(service);
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(1);

Scenario.skip(
  'PMM-T2269 - Verify Replicaset dashboard for MongoDB Instances contains ARBITER node @pmm-psmdb-arbiter-integration @not-ui-pipeline',
  async ({
    I, dashboardPage,
  }) => {
    const arbiterLocator = '(//div[@ng-show="ctrl.panel.showLegend"][contains(.,"ARBITER")])[1]';

    I.amOnPage(`${dashboardPage.mongodbReplicaSetSummaryDashboard.url}&var-replset=rs`);
    dashboardPage.waitForDashboardOpened();
    await I.waitForElement({ xpath: arbiterLocator }, 60);
    const numberOfVisibleElements = await I.grabNumberOfVisibleElements(arbiterLocator);

    I.assertEqual(numberOfVisibleElements, 1, 'No of ARBITER elements for ReplicatSet are not as expected');
  },
).retry(2);

Scenario(
  'PMM-T1775 + PMM-T1888 - Verify Wrong Replication Lag by Set values if RS is PSA -( MongoDB Cluster Summary) @pmm-psmdb-arbiter-integration @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    const username = 'pmm';
    const password = 'pmmpass';
    const arbiter_container_name = 'rs103';

    // Check if logs has arbiter connection
    await I.asyncWaitFor(async () => {
      const checkLog = await I.verifyCommand(`docker exec ${arbiter_container_name} grep -q "level=warning.*some metrics might be unavailable on arbiter nodes" /var/log/pmm-agent.log; echo $?`);

      return checkLog;
    }, 60);

    // Check if there are no errors but only warnings
    let errorCode = 0;

    errorCode = (await I.verifyCommand(`docker exec ${arbiter_container_name} grep -q "level=error.*some metrics might be unavailable on arbiter nodes" /var/log/pmm-agent.log; echo $?`));
    I.assertTrue(errorCode.includes(1), `No errors for arbiter setup expected but got error code: ${errorCode}`);

    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, { from: 'now-5m', refresh: '5s' }));
    dashboardPage.waitForDashboardOpened();
    I.click(dashboardPage.fields.reportTitle);
    await adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    const testConfigFile = 'c = rs.conf(); c.members[1].secondaryDelaySecs = 10; c.members[1].priority = 0; c.members[1].hidden = true; rs.reconfig(c);';

    await I.verifyCommand(`sudo docker exec rs101 mongo "mongodb://root:root@localhost/?replicaSet=rs" --eval "${testConfigFile}"`);

    // Gather Secondary member Service Name from Mongo
    const secondaryServiceName = (await I.verifyCommand(`docker exec ${arbiter_primary_container_name} mongo --eval rs\.printSecondaryReplicationInfo\\(\\) --username=${username} --password=${password} | awk -F ":" '/source/ {print $2}'`)).trim();

    I.waitForElement(await dashboardPage.graphsLocator('Replication Lag'), 20);
    I.scrollTo(await dashboardPage.graphsLocator('Replication Lag'));

    await dashboardPage.verifyColumnLegendMaxValueAbove('Replication Lag', secondaryServiceName, 1, 240);

    const maxValue = await I.grabTextFrom(dashboardPage.getColumnLegendMaxValue('Replication Lag', secondaryServiceName));

    I.assertFalse(/min|hour|day|week|month|year/.test(maxValue), `Max replication value should be in seconds. Value is: ${maxValue}`);
  },
).retry(1);

Scenario('PMM-T1889 - Verify Mongo replication lag graph shows correct info @pmm-psmdb-replica-integration', async ({ I, dashboardPage, adminPage }) => {
  const lagValue = 10;
  const testConfigFile = `c = rs.conf(); c.members[2].secondaryDelaySecs = ${lagValue}; c.members[2].priority = 0; c.members[2].hidden = true; rs.reconfig(c);`;
  const serviceName = 'rs103';
  const graphName = 'Replication Lag';

  await I.verifyCommand(`sudo docker exec rs101 mongo "mongodb://root:root@localhost/?replicaSet=rs" --eval "${testConfigFile}"`);
  I.amOnPage(I.buildUrlWithParams(dashboardPage.mongodbReplicaSetSummaryDashboard.cleanUrl, { from: 'now-5m', refresh: '5s' }));
  dashboardPage.waitForDashboardOpened();
  I.click(dashboardPage.fields.reportTitle);
  await adminPage.performPageDown(5);

  await dashboardPage.expandEachDashboardRow();
  I.waitForElement(await dashboardPage.graphsLocator(graphName), 20);
  I.scrollTo(await dashboardPage.graphsLocator(graphName));
  await dashboardPage.verifyColumnLegendMaxValueAbove(graphName, serviceName, 1, 240);

  const maxValue = await I.grabTextFrom(dashboardPage.getColumnLegendMaxValue(graphName, serviceName));

  I.assertFalse(/min|hour|day|week|month|year/.test(maxValue), `Max replication value should be in seconds. Value is: ${maxValue}`);
});
