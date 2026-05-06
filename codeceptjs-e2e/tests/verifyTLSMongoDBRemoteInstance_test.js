const assert = require('assert');
const { SERVICE_TYPE } = require('./helper/constants');

const { adminPage } = inject();
const pathToPMMFramework = adminPage.pathToPMMTests;

Feature('Monitoring SSL/TLS MongoDB instances');

const instances = new DataTable(['serviceName', 'version', 'container', 'serviceType', 'metric', 'maxQueryLength']);

// instances.add(['mongodb_4.4_ssl_service', '4.4', 'mongodb_4.4', 'mongodb_ssl', 'mongodb_connections', '7']);
// instances.add(['mongodb_4.2_ssl_service', '4.2', 'mongodb_4.2', 'mongodb_ssl', 'mongodb_connections']);
// instances.add(['mongodb_5.0_ssl_service', '5.0', 'mongodb_5.0', 'mongodb_ssl', 'mongodb_connections', '7']);
instances.add(['psmdb-server', '6.0', 'psmdb-server', 'mongodb_ssl', 'mongodb_connections', '7']);

let serviceName;

BeforeSuite(async ({ inventoryAPI }) => {
  const { service_name } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, 'psmdb-server');

  serviceName = service_name;
});

Before(async ({ I }) => {
  await I.Authorize();
});

Data(instances).Scenario(
  'PMM-T888 + PMM-T919 - Verify Adding SSL services remotely @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, current, inventoryAPI,
  }) => {
    const {
      serviceName, serviceType, container,
    } = current;
    let details;
    const remoteServiceName = `remote_${serviceName}`;

    if (serviceType === 'mongodb_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '27017',
        host: container,
        cluster: 'mongodb_remote_cluster',
        environment: 'mongodb_remote_cluster',
        tlsCAFile: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/ca-certs.pem`,
        tlsCertificateFilePasswordInput: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/certificate.crt`,
        tlsCertificateKeyFile: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/client.pem`,
      };
    }

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage(serviceType);
    await remoteInstancesPage.addRemoteSSLDetails(details);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MONGODB,
        service: 'mongodb',
      },
      remoteServiceName,
    );

    // Check Remote Instance also added and have running status
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(remoteServiceName);

    // Skip due to new inventory
    // await pmmInventoryPage.verifyAgentHasStatusRunning(remoteServiceName);
  },
);

Data(instances).Scenario(
  'Verify metrics from SSL instances on PMM-Server @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, current, grafanaAPI, inventoryAPI,
  }) => {
    const {
      serviceName, metric,
    } = current;
    const remoteServiceName = `remote_${serviceName}`;

    // Use Mongo service_id instead of service_name due to Bug#PMM-13554
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, serviceName);
    const { remote_service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, remoteServiceName);

    // Waiting for metrics to start hitting for remotely added services
    I.wait(10);

    // verify metric for client container node instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_id', value: service_id });
    // verify metric for remote instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_id', value: remote_service_id });
  },
).retry(1);

Data(instances).Scenario(
  'PMM-T926 + PMM-T927 Verify there is no possibility to add MongoDB Service with only CA file specified,'
    + 'Verify there is no possibility to add MongoDB Service with only certificate file specified @ssl @ssl-mongo @ssl-remote @not-ui-pipeline',
  async ({
    I, current, dashboardPage,
  }) => {
    const {
      container,
    } = current;
    let responseMessage = 'Connection check failed: server selection error: server selection timeout, current topology:';
    let command = `docker exec ${container} pmm-admin add mongodb --tls --tls-skip-verify --authentication-mechanism=MONGODB-X509 --authentication-database=$external --tls-ca-file=/mongodb_certs/certificate.crt TLS_MongoDB_Service`;

    I.amOnPage(dashboardPage.mongoDbInstanceOverview.url);

    let output = await I.verifyCommand(command, responseMessage, 'fail');

    assert.ok(output.includes(responseMessage), `The ${command} was supposed to return output which contained ${responseMessage} but actually got ${output}`);

    responseMessage = 'Connection check failed: server selection error: server selection timeout, current topology:';
    command = `docker exec ${container} pmm-admin add mongodb --tls --authentication-mechanism=MONGODB-X509 --authentication-database=$external --tls-certificate-key-file=/mongodb_certs/client.pem TLS_MongoDB_Service`;

    output = await I.verifyCommand(command, responseMessage, 'fail');

    assert.ok(output.includes(responseMessage), `The ${command} was supposed to return output which contained ${responseMessage} but actually got ${output}`);
  },
).retry(1);

Scenario(
  'Verify dashboard after MongoDB SSL Instances are added @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, dashboardPage, adminPage,
  }) => {
    const serviceList = [serviceName, `remote_${serviceName}`];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(dashboardPage.mongoDbInstanceOverview.clearUrl, {
        service_name: service,
        from: 'now-5m',
        refresh: '10s',
      }));
      dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
    }
  },
).retry(1);

// Fixme: PMM-14188 - Verify QAN after MongoDB SSL Instances is added
Scenario.skip(
  'Verify QAN after MongoDB SSL Instances is added @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const serviceList = [serviceName, `remote_${serviceName}`];

    for (const service of serviceList) {
      I.wait(180);
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m', refresh: '10s' }));
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilter(service);
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(4);

Data(instances).Scenario(
  'PMM-T1276 - Verify tlsCa, tlsCert, tlsKey are generated on every MongoDB exporter (added with TLS flags) restart @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, current, dashboardPage,
  }) => {
    const {
      container,
    } = current;

    I.amOnPage(dashboardPage.mySQLInstanceOverview.url);

    const agent_id = await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mongodb_exporter | awk -F" " '{print $4}'`);

    await I.verifyCommand(`docker exec ${container} ls -la /usr/local/percona/pmm/tmp/agent_type_mongodb_exporter/${agent_id}/ | grep caFile`);
    await I.verifyCommand(`docker exec ${container} rm -r /usr/local/percona/pmm/tmp/agent_type_mongodb_exporter/`);
    await I.verifyCommand(`docker exec ${container} ls -la /usr/local/percona/pmm/tmp/agent_type_mongodb_exporter/`, 'ls: cannot access \'/usr/local/percona/pmm/tmp/agent_type_mongodb_exporter\': No such file or directory', 'fail');
    await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mongodb_exporter | grep Running`);
    await I.verifyCommand(`docker exec ${container} pkill -f mongodb_exporter`);
    I.wait(10);
    await I.verifyCommand(`docker exec ${container} pmm-admin list | grep mongodb_exporter | grep Running`);
    await I.verifyCommand(`docker exec ${container} ls -la /usr/local/percona/pmm/tmp/agent_type_mongodb_exporter/${agent_id}/ | grep caFile`);
  },
).retry(1);

Data(instances).Scenario(
  'PMM-T1431 - Verify adding MongoDB instance via UI with specified Max Query Length option @max-length @ssl @ssl-remote @ssl-mongo @not-ui-pipeline',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, inventoryAPI, current,
  }) => {
    const {
      serviceName, serviceType, container, maxQueryLength,
    } = current;
    let details;
    const remoteServiceName = `MaxQueryLength_remote_${serviceName}`;

    if (serviceType === 'mongodb_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '27017',
        host: container,
        cluster: 'mongodb_remote_cluster',
        environment: 'mongodb_remote_cluster',
        tlsCAFile: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/ca-certs.pem`,
        tlsCertificateFilePasswordInput: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/certificate.crt`,
        tlsCertificateKeyFile: `${pathToPMMFramework}../pmm_psmdb_diffauth_setup/certs/client.pem`,
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
        serviceType: SERVICE_TYPE.MONGODB,
        service: 'mongodb',
      },
      remoteServiceName,
    );

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, remoteServiceName);

    // Check Remote Instance also added and have correct max_query_length option set
    await pmmInventoryPage.openAgents(service_id);
    if (maxQueryLength !== '') {
      await pmmInventoryPage.checkAgentOtherDetailsSection('Qan mongodb profiler agent', `max_query_length=${maxQueryLength}`);
    } else {
      await pmmInventoryPage.checkAgentOtherDetailsSection('Qan mongodb profiler agent', `max_query_length=${maxQueryLength}`, false);
    }
  },
);
