const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');
const connection = require('../pages/credentials');

const { adminPage } = inject();

Feature('Integration tests for Percona Server & PMM');

Before(async ({ I, settingsAPI }) => {
  await I.Authorize();
});

const version = process.env.PS_VERSION ? `${process.env.PS_VERSION}` : '8.0';
const container_name = `ps_pmm_${version}_1`;
const remoteServiceName = 'remote_pmm-mysql-integration';

Scenario(
  'Verify Adding Mysql services remotely @pmm-ps-integration @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, inventoryAPI,
  }) => {
    const port = await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "MySQL" | awk -F":" '{print $2}' | awk -F" " '{ print $1}' | head -1`);
    const details = {
      serviceName: remoteServiceName,
      serviceType: SERVICE_TYPE.MYSQL,
      port,
      username: connection.perconaServer.msandbox.username,
      password: connection.perconaServer.msandbox.password,
      host: container_name,
      cluster: 'ps_remote_cluster',
      environment: 'ps_remote_cluster',
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
    I.wait(10);
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
  'Verify metrics from PS instances on PMM-Server @pmm-ps-integration @not-ui-pipeline',
  async ({
    I, grafanaAPI,
  }) => {
    let response; let result;
    const metricName = 'mysql_global_status_max_used_connections';

    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "mysqld_exporter" | grep "Running" | wc -l | grep "1"`);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "mysql_perfschema_agent" | grep "Running" | wc -l | grep "1"`);

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
  'Verify dashboard after PS Instances are added @pmm-ps-integration @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    const clientServiceName = (await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep MySQL | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      const url = I.buildUrlWithParams(dashboardPage.mysqlInstanceSummaryDashboard.clearUrl, { from: 'now-5m', to: 'now', service_name: service });

      I.amOnPage(url);
      await dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      if (service === remoteServiceName) {
        await dashboardPage.verifyThereAreNoGraphsWithoutData(15);
      } else {
        await dashboardPage.verifyThereAreNoGraphsWithoutData(6);
      }
    }
  },
).retry(2);

Scenario(
  'Verify QAN after PS Instances is added @pmm-ps-integration @not-ui-pipeline',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const clientServiceName = (await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep MySQL | head -1 | awk -F" " '{print $2}'`)).trim();

    const serviceList = [clientServiceName, remoteServiceName];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-12h' }));
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilterInGroup(service, 'Service Name');
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(1);

Scenario(
  'PMM-T1897 - Verify Query Count metric on QAN page for MySQL @fb-pmm-ps-integration',
  async ({
    I, credentials, queryAnalyticsPage,
  }) => {
    const dbName = 'sbtest3';
    const sbUser = { name: 'sysbench', password: 'test' };
    const testContainerName = await I.verifyCommand('docker ps -f name=ps --format "{{.Names }}"');
    const containerPort = testContainerName.includes('8.4') ? 3306 : 3307;

    // Add wait for Queries to appear in PMM
    await I.wait(60);

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${credentials.perconaServer.root.username} -p${credentials.perconaServer.root.password} -e "CREATE USER IF NOT EXISTS sysbench@'%' IDENTIFIED BY 'test'; GRANT ALL ON *.* TO sysbench@'%'; DROP DATABASE IF EXISTS ${dbName};"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} -e "SET GLOBAL slow_query_log=ON;"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} -e "SET GLOBAL long_query_time=0;"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} -e "CREATE DATABASE ${dbName}"`);

    for (let i = 1; i <= 5; i++) {
      await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} ${dbName} -e "CREATE TABLE Persons${i} ( PersonID int, LastName varchar(255), FirstName varchar(255), Address varchar(255), City varchar(255) );"`);
      for (let j = 0; j <= 4; j++) {
        await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} ${dbName} -e "INSERT INTO Persons${i} values (${j},'Qwerty','Qwe','Address','City');"`);
      }

      await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${sbUser.name} -p${sbUser.password} ${dbName} -e "select count(*) from Persons${i};"`);
    }

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-1h', refresh: '5s' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(dbName);
    queryAnalyticsPage.waitForLoaded();
    for (let i = 0; i <= 24; i++) {
      I.refreshPage();
      const countOfQueries = parseInt((await I.grabTextFrom(queryAnalyticsPage.data.elements.totalItems)).split('of ')[1], 10);

      I.wait(10);
      if (countOfQueries <= 17) continue;

      if (i === 24) assert.ok(countOfQueries <= 17, 'Count of queries is incorrect');
    }
  },
).retry(1);

Scenario(
  'PMM-T2034 - Verify the same query on different tables for MySQL @fb-pmm-ps-integration',
  async ({
    I, credentials, queryAnalyticsPage,
  }) => {
    const dbName1 = 'testdb1';
    const dbName2 = 'testdb2';
    const tableNameDb1 = `${dbName1}.samequery`;
    const tableNameDb2 = `${dbName2}.samequery`;
    const tableName = 'samequery';
    const user = credentials.perconaServer.root;
    const testContainerName = await I.verifyCommand('docker ps -f name=ps --format "{{.Names }}"');
    const containerPort = testContainerName.includes('8.4') ? 3306 : 3307;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    await I.cleanupClickhouse();

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "CREATE DATABASE IF NOT EXISTS ${dbName1}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "CREATE DATABASE IF NOT EXISTS ${dbName2}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "DROP TABLE IF EXISTS ${tableNameDb1}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "DROP TABLE IF EXISTS ${tableNameDb2}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName1}; CREATE TABLE IF NOT EXISTS ${tableNameDb1} (
    ID INT NOT NULL,
    Value INT,
    PRIMARY KEY (ID)
);"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName2}; CREATE TABLE IF NOT EXISTS ${tableNameDb2} (
    ID INT NOT NULL,
    Value INT,
    PRIMARY KEY (ID)
);"`);

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName1}; INSERT INTO ${tableName} (ID, Value) VALUES (1, 1);"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName1}; INSERT INTO ${tableName} (ID, Value) VALUES (2, 2);"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName2}; INSERT INTO ${tableName} (ID, Value) VALUES (1, 1);"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName2}; INSERT INTO ${tableName} (ID, Value) VALUES (2, 2);"`);

    I.wait(60);

    const queryStartText = 'insert into';

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue(tableName);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRowByQueryStart(queryStartText);

    const queryCountLocator = queryAnalyticsPage.queryDetails.elements.metricsCellDetailValue('Query Count', 3);

    I.waitForVisible(queryCountLocator, 30);
    I.seeTextEquals('4.00', queryCountLocator);

    queryAnalyticsPage.filters.selectFilter(dbName1);

    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRowByQueryStart(queryStartText);

    I.waitForVisible(queryCountLocator, 30);
    I.seeTextEquals('2.00', queryCountLocator);

    queryAnalyticsPage.filters.selectFilter(dbName1);
    queryAnalyticsPage.filters.selectFilter(dbName2);

    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRowByQueryStart(queryStartText);

    I.waitForVisible(queryCountLocator, 30);
    I.seeTextEquals('2.00', queryCountLocator);
  },
).retry(1);

Scenario(
  'PMM-T2040 - Verify there is no error while clicking on Table or Examples or Explain @fb-pmm-ps-integration',
  async ({
    I, credentials, queryAnalyticsPage,
  }) => {
    const dbName = 'dbT2040';
    const tableName = 'tabletodelete';
    const user = credentials.perconaServer.root;
    const testContainerName = await I.verifyCommand('docker ps -f name=ps --format "{{.Names }}"');
    const containerPort = testContainerName.includes('8.4') ? 3306 : 3307;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    await I.cleanupClickhouse();

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "CREATE DATABASE IF NOT EXISTS ${dbName}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName}; DROP TABLE IF EXISTS ${tableName}"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName}; CREATE TABLE IF NOT EXISTS ${tableName} (
    ID INT NOT NULL,
    Value INT,
    PRIMARY KEY (ID)
);"`);

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName}; INSERT INTO ${tableName} (ID, Value) VALUES (1, 1);"`);
    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName}; SELECT ID, Value FROM ${tableName} WHERE ID = 1;"`);

    I.wait(60);
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));

    await I.verifyCommand(`docker exec ${testContainerName} mysql -h 127.0.0.1 --port ${containerPort} -u ${user.username} -p${user.password} -e "USE ${dbName}; DROP TABLE IF EXISTS ${tableName}"`);

    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.searchByValue(tableName);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.selectRowByQueryStart('select');
    await I.verifyInvisible(I.getPopUpLocator(), 5);

    queryAnalyticsPage.queryDetails.openExamplesTab();
    await I.verifyInvisible(I.getPopUpLocator(), 5);

    queryAnalyticsPage.queryDetails.openExplainTab();
    await I.verifyInvisible(I.getPopUpLocator(), 5);

    queryAnalyticsPage.queryDetails.openTablesTab();
    await I.verifyInvisible(I.getPopUpLocator(), 5);
  },
);
