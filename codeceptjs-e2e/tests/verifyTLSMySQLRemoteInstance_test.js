const assert = require('assert');
const faker = require('faker');
const { SERVICE_TYPE, AGENT_NAMES } = require('./helper/constants');

const { adminPage } = inject();

Feature('Monitoring SSL/TLS MYSQL instances');

const instances = new DataTable(['serviceName', 'version', 'container', 'serviceType', 'metric']);
const maxQueryLengthInstances = new DataTable(['serviceName', 'version', 'container', 'serviceType', 'metric', 'maxQueryLength']);
const maxQueryLengthTestData = new DataTable(['text']);

maxQueryLengthTestData.add(['---;']);
maxQueryLengthTestData.add(['aa']);
maxQueryLengthTestData.add(['^']);
maxQueryLengthTestData.add(['`']);
maxQueryLengthTestData.add(['"']);

// instances.add(['mysql_5.7_ssl_service', '5.7', 'mysql_5.7', 'mysql_ssl', 'mysql_global_status_max_used_connections']);
instances.add(['mysql_8.0_ssl_service', '8.0', 'mysql_ssl_8.0', 'mysql_ssl', 'mysql_global_status_max_used_connections']);

// maxQueryLengthInstances.add(['mysql_5.7_ssl_service', '5.7', 'mysql_5.7', 'mysql_ssl', 'mysql_global_status_max_used_connections', '10']);
// maxQueryLengthInstances.add(['mysql_5.7_ssl_service', '5.7', 'mysql_5.7', 'mysql_ssl', 'mysql_global_status_max_used_connections', '-1']);
// maxQueryLengthInstances.add(['mysql_5.7_ssl_service', '5.7', 'mysql_5.7', 'mysql_ssl', 'mysql_global_status_max_used_connections', '']);
maxQueryLengthInstances.add(['mysql_8.0_ssl_service', '8.0', 'mysql_ssl_8.0', 'mysql_ssl', 'mysql_global_status_max_used_connections', '10']);
maxQueryLengthInstances.add(['mysql_8.0_ssl_service', '8.0', 'mysql_ssl_8.0', 'mysql_ssl', 'mysql_global_status_max_used_connections', '-1']);
maxQueryLengthInstances.add(['mysql_8.0_ssl_service', '8.0', 'mysql_ssl_8.0', 'mysql_ssl', 'mysql_global_status_max_used_connections', '']);

let serviceName;

BeforeSuite(async ({ inventoryAPI }) => {
  const { service_name } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, 'mysql_ssl_8.0_ssl_service', 'remote');

  serviceName = service_name;
});

Before(async ({ I }) => {
  await I.Authorize();
});

Data(instances).Scenario(
  'Verify Adding SSL Mysql services remotely @ssl @ssl-remote @ssl-mysql @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, current, inventoryAPI,
  }) => {
    const {
      serviceType, version, container,
    } = current;
    let details;
    const remoteServiceName = `remote_${serviceName}_faker`;

    await I.say(await I.verifyCommand(`docker exec ${container} bash -c 'source ~/.bash_profile || true; pmm-admin list'`));

    if (serviceType === 'mysql_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '3306',
        host: container,
        username: 'pmm',
        password: 'pmm',
        cluster: 'mysql_remote_cluster',
        environment: 'mysql_remote_cluster',
        tlsCAFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/ca.pem`,
        tlsKeyFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/client-key.pem`,
        tlsCertFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/client-cert.pem`,
      };
    }

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage(serviceType);
    await remoteInstancesPage.addRemoteSSLDetails(details);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    // Add wait for service status to be updated
    I.wait(10);
    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      },
      remoteServiceName,
    );

    // Check Remote Instance also added and have running status
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(remoteServiceName);
    // await pmmInventoryPage.verifyAgentHasStatusRunning(remoteServiceName);
  },
);

Scenario(
  'Verify metrics from mysql SSL instances on PMM-Server @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({
    I, grafanaAPI,
  }) => {
    const metric = 'mysql_global_status_max_used_connections';
    const remoteServiceName = `remote_${serviceName}_faker`;

    // Waiting for metrics to start hitting for remotely added services
    I.wait(60);

    // verify metric for client container node instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_name', value: serviceName });
    // verify metric for remote instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_name', value: remoteServiceName });
  },
).retry(1);

Data(instances).Scenario(
  'PMM-T937 + PMM-T938 + PMM-T2093 - Verify MySQL can be added without specified --tls-key, Verify MySQL can be added without specified --tls-cert, Verify adding MySQL for monitoring using --tls-ca only @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({
    I, current, remoteInstancesPage,
  }) => {
    const {
      container,
    } = current;

    I.amOnPage(remoteInstancesPage.url);

    const responseMessage = 'MySQL Service added.';
    let command = `docker exec ${container} pmm-admin add mysql --username=pmm --password=pmm --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-cert=/var/lib/mysql/client-cert.pem TLS_mysql_no_tls_key`;
    let output = await I.verifyCommand(command, responseMessage, 'pass');

    command = `docker exec ${container} pmm-admin add mysql --username=pmm --password=pmm --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-key=/var/lib/mysql/client-key.pem TLS_mysql_no_tls_cert`;
    output = await I.verifyCommand(command, responseMessage, 'pass');

    command = `docker exec ${container} pmm-admin add mysql --username=pmm --password=pmm --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem TLS_mysql_only_ca`;
    output = await I.verifyCommand(command, 'MySQL Service added.', 'pass');
  },
).retry(0);

Scenario(
  'Verify dashboard after MySQL SSL Instances are added @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    const serviceList = [serviceName, `remote_${serviceName}`];

    for (const service of serviceList) {
      // Wait for metrics to start hitting
      I.wait(60);
      I.amOnPage(I.buildUrlWithParams(
        dashboardPage.mySQLInstanceOverview.clearUrl,
        { service_name: service, from: 'now-5m', refresh: '10s' },
      ));

      dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
    }
  },
).retry(4);

Scenario(
  'Verify QAN after MySQL SSL Instances is added @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const serviceList = [serviceName, `remote_${serviceName}_faker`];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilter(service);
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(1);

Data(instances).Scenario(
  'PMM-T1277 - Verify tlsCa, tlsCert, tlsKey are generated on every MySQL exporter (added with TLS flags) restart @ssl-mysql @ssl @ssl-remote @not-ui-pipeline',
  async ({
    I, current, dashboardPage,
  }) => {
    const {
      container,
    } = current;

    I.amOnPage(dashboardPage.mySQLInstanceOverview.url);

    const agent_id = await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mysqld_exporter | awk -F" " '{print $4}' | awk -F"/" '{print $3}'`);

    await I.verifyCommand(`docker exec ${container} ls -R /usr/local/percona/pmm/tmp/agent_type_mysqld_exporter/${agent_id} | grep tls`);
    await I.verifyCommand(`docker exec ${container} rm -r /usr/local/percona/pmm/tmp/agent_type_mysqld_exporter/`);
    await I.verifyCommand(`docker exec ${container} ls -R /usr/local/percona/pmm/tmp/agent_type_mysqld_exporter/`, 'ls: cannot access \'/usr/local/percona/pmm/tmp/agent_type_mysqld_exporter\': No such file or directory', 'fail');
    await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mysqld_exporter | grep Running`);
    await I.verifyCommand(`docker exec ${container} pkill -f mysqld_exporter`);
    I.wait(10);
    await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mysqld_exporter | grep Running`);
    await I.verifyCommand(`docker exec ${container} ls -R /usr/local/percona/pmm/tmp/agent_type_mysqld_exporter/${agent_id} | grep tls`);
  },
).retry(1);

Data(maxQueryLengthTestData).Scenario(
  'PMM-T1405 - Verify validation of Max Query Length option on Add remote MySQL page @max-length @ssl @ssl-mysql @ssl-remote @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, current,
  }) => {
    const maxLength = current.text;

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mysql');
    I.fillField(remoteInstancesPage.fields.maxQueryLength, maxLength);
    I.waitForText('Value should be greater or equal to -1', 30, remoteInstancesPage.fields.maxQueryLengthError);
  },
);

Data(maxQueryLengthInstances).Scenario(
  'PMM-T1403 + PMM-T1404 + PMM-T1426 + PMM-T1431 - Verify Max Query Length field is not required on Add remote MySQL instance page'
    + ' Verify Max Query Length option can be set to -1 on Add remote MySQL page'
    + ' Verify remote PostgreSQL can be added with specified Max Query Length'
    + ' Verify adding MongoDB instance via UI with specified Max Query Length option @max-length @ssl @ssl-remote @ssl-mysql @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, inventoryAPI, current, queryAnalyticsPage,
  }) => {
    const {
      serviceType, version, container, maxQueryLength,
    } = current;
    let details;
    const remoteServiceName = `MaxQueryLength_remote_${serviceName}_${faker.random.alphaNumeric(3)}`;

    if (serviceType === 'mysql_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '3306',
        host: container,
        username: 'pmm',
        password: 'pmm',
        cluster: 'mysql_remote_cluster',
        environment: 'mysql_remote_cluster',
        tlsCAFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/ca.pem`,
        tlsKeyFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/client-key.pem`,
        tlsCertFile: `${adminPage.pathToPMMTests}tls-ssl-setup/mysql/${version}/client-cert.pem`,
      };
    }

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage(serviceType);
    await remoteInstancesPage.addRemoteSSLDetails(details);
    I.fillField(remoteInstancesPage.fields.maxQueryLength, maxQueryLength);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();

    // Check Remote Instance also added and have running status
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(remoteServiceName);

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      },
      remoteServiceName,
    );

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MYSQL, remoteServiceName);

    if (maxQueryLength !== '') {
      await pmmInventoryPage.openAgents(service_id);
      await pmmInventoryPage.checkAgentOtherDetailsSection(AGENT_NAMES.QAN_MYSQL_PERFSCHEMA_AGENT, `max_query_length=${maxQueryLength}`);
    }

    // This extra time is needed for queries to appear in QAN
    await I.wait(70);
    // Check max visible query length is less than max_query_length option
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(remoteServiceName);
    await I.wait(5);
    await I.waitForElement(queryAnalyticsPage.data.elements.queryRows, 30);
    const queryFromRow = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryRowValue(1));

    if (maxQueryLength !== '' && maxQueryLength !== '-1') {
      assert.ok(queryFromRow.length <= maxQueryLength, `Query length exceeds max length boundary equals ${queryFromRow.length} is more than ${maxQueryLength}`);
    } else {
      // 6 is chosen because it's the length of "SELECT" any query that starts with that word should be longer
      assert.ok(queryFromRow.length >= 6, `Query length is equal to ${queryFromRow.length} which is less than minimal possible length`);
      queryAnalyticsPage.data.selectRow(1);
      queryAnalyticsPage.waitForLoaded();
      queryAnalyticsPage.queryDetails.checkExamplesTab();
      queryAnalyticsPage.queryDetails.checkTab('Explain');
    }
  },
);

Data(instances).Scenario(
  'PMM-T1896 - Verify MySQL w/ tls/ssl certs can be added when specified with --tls-skip-verify @ssl @ssl-mysql @not-ui-pipeline',
  async ({
    I, current, pmmInventoryPage,
  }) => {
    const {
      version, container,
    } = current;
    const serviceName = `TLS_mysql_${version}`;
    const responseMessage = 'MySQL Service added';
    const command = `docker exec ${container} pmm-admin add mysql --username=pmm_tls --port=3306 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/var/lib/mysql/ca.pem --tls-cert=/var/lib/mysql/client-cert.pem --tls-key=/var/lib/mysql/client-key.pem ${serviceName}`;
    const output = await I.verifyCommand(command);

    I.assertTrue(output.includes(responseMessage), `The ${command} was supposed to return ${responseMessage} but actually got ${output}`);
    I.amOnPage(pmmInventoryPage.url);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
  },
);
