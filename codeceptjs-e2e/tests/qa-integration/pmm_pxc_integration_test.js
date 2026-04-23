const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

const { adminPage } = inject();

Feature('Integration tests for PXC & PMM');

Before(async ({ I, settingsAPI }) => {
  await I.Authorize();
});

const version = process.env.PXC_VERSION ? `${process.env.PXC_VERSION}` : '8.0';
const container_name = `pxc_proxysql_pmm_${version}`;
const remoteServiceName = 'remote_pmm-mysql-integration';

const connection = {
  host: container_name,
  username: 'admin',
  password: 'admin',
};

Scenario(
  'Verify Adding PXC services remotely @pmm-pxc-integration @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, inventoryAPI,
  }) => {
    const port = await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "MySQL" | grep "pxc_node" | awk -F":" '{print $2}' | awk -F" " '{ print $1}' | head -1`);
    const details = {
      serviceName: remoteServiceName,
      serviceType: SERVICE_TYPE.MYSQL,
      port,
      username: connection.username,
      password: connection.password,
      host: container_name,
      cluster: 'pxc_remote_cluster',
      environment: 'pxc_remote_cluster',
    };

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mysql');
    I.waitForElement(remoteInstancesPage.fields.hostName, 30);
    remoteInstancesPage.selectDropdownOption('$nodes-selectbox', 'pmm-server');
    I.fillField(remoteInstancesPage.fields.hostName, details.host);
    I.clearField(remoteInstancesPage.fields.portNumber);
    I.fillField(remoteInstancesPage.fields.portNumber, details.port);
    I.fillField(remoteInstancesPage.fields.userName, details.username);
    I.fillField(remoteInstancesPage.fields.serviceName, remoteServiceName);
    I.fillField(remoteInstancesPage.fields.password, details.password);
    I.fillField(remoteInstancesPage.fields.environment, details.environment);
    I.fillField(remoteInstancesPage.fields.cluster, details.cluster);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    // I.waitForVisible(pmmInventoryPage.fields.agentsLink, 30);
    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      },
      details.serviceName,
    );

    // Check Remote Instance also added and have running status
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(remoteServiceName);
    await pmmInventoryPage.verifyAgentHasStatusRunning(remoteServiceName);
  },
);

Scenario(
  'Verify metrics from PXC instances on PMM-Server @pmm-pxc-integration @not-ui-pipeline',
  async ({
    I, grafanaAPI,
  }) => {
    let response; let result;
    const metricName = 'mysql_global_status_max_used_connections';

    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "mysqld_exporter" | grep "Running" | wc -l | grep "3"`);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "mysql_perfschema_agent" | grep "Running" | wc -l | grep "3"`);

    const clientServiceName = (await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep MySQL | head -1 | awk -F" " '{print $2}'`)).trim();

    // Waiting for metrics to start hitting for remotely added services
    I.wait(10);

    // verify metric for client container node instance
    response = await grafanaAPI.checkMetricExist(metricName, { type: 'service_name', value: clientServiceName });
    result = JSON.stringify(response.data.results);

    assert.ok(response.data.results.A.frames[0].data.values.length !== 0, `Metrics ${metricName} from ${clientServiceName} should be available but got empty ${result}`);

    // verify metric for remote instance
    response = await grafanaAPI.checkMetricExist(metricName, { type: 'service_name', value: remoteServiceName });
    result = JSON.stringify(response.data.results);

    assert.ok(response.data.results.A.frames[0].data.values.length !== 0, `Metrics ${metricName} from ${remoteServiceName} should be available but got empty ${result}`);
  },
).retry(1);

Scenario(
  'Verify dashboard after PXC Instances are added @pmm-pxc-integration @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    let url;
    const clientServiceName = (await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep MySQL | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      url = I.buildUrlWithParams(dashboardPage.mysqlPXCGaleraNodeSummaryDashboard.clearUrl, { from: 'now-15m', service_name: service });

      I.amOnPage(url);
      I.wait(30);
      await dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      if (service === remoteServiceName) {
        await dashboardPage.verifyThereAreNoGraphsWithoutData(6);
      } else {
        await dashboardPage.verifyThereAreNoGraphsWithoutData(3);
      }
    }

    I.amOnPage(dashboardPage.proxysqlInstanceSummaryDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await adminPage.applyTimeRange('Last 5 minutes');
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.proxysqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(6);

    I.amOnPage(dashboardPage.pxcGaleraClusterSummaryDashboard.url);
    await dashboardPage.waitForDashboardOpened();
    await adminPage.applyTimeRange('Last 5 minutes');
    adminPage.performPageDown(5);
    await dashboardPage.expandEachDashboardRow();
    adminPage.performPageUp(5);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
  },
).retry(3);

Scenario(
  'Verify QAN after PXC Instances is added @pmm-pxc-integration @not-ui-pipeline',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const clientServiceName = (await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep MySQL | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-120m', to: 'now' }));

      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilterInGroup(service, 'Service Name');
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(1);
