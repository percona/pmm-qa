const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('PMM upgrade tests for SSL');

const { adminPage, dashboardPage } = inject();
const pathToPMMFramework = adminPage.pathToPMMTests;
const sslinstances = new DataTable(['serviceName', 'version', 'container', 'serviceType', 'metric', 'dashboard', 'databaseType']);

sslinstances.add(['pdpgsql_pgsm_ssl', '17', 'pdpgsql_pgsm_ssl_17', 'postgres_ssl', 'pg_stat_database_xact_rollback', dashboardPage.postgresqlInstanceOverviewDashboard.url, 'postgresql']);
sslinstances.add(['mysql_ssl', '8.0', 'mysql_ssl_8.0', 'mysql_ssl', 'mysql_global_status_max_used_connections', dashboardPage.mySQLInstanceOverview.url, 'mysql']);
sslinstances.add(['psmdb-server', '6.0', 'psmdb-server', 'mongodb_ssl', 'mongodb_connections', dashboardPage.mongoDbInstanceOverview.url, 'mongodb']);

Before(async ({ I }) => {
  await I.Authorize();
});

Data(sslinstances).Scenario(
  'PMM-T948 + PMM-T947 - Verify Adding Postgresql, MySQL, MongoDB SSL services remotely via API before upgrade @pre-ssl-upgrade',
  async ({
    I, remoteInstancesPage, current, addInstanceAPI, inventoryAPI, credentials,
  }) => {
    const {
      serviceName, serviceType, version, container,
    } = current;
    let details;
    const remoteServiceName = `remote_api_${serviceName}`;

    if (serviceType === 'postgres_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: credentials.pdpgsql_ssl.port,
        database: 'postgres',
        address: container,
        username: credentials.pdpgsql_ssl.username,
        password: credentials.pdpgsql_ssl.password,
        cluster: 'pgsql_remote_cluster',
        environment: 'pgsql_remote_cluster',
        tlsCAFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/postgres/${version}/ca.crt`),
        tlsKeyFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/postgres/${version}/client.pem`),
        tlsCertFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/postgres/${version}/client.crt`),
      };
      await addInstanceAPI.addPostgreSqlSSL(details);
      I.wait(5);
      await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
        {
          serviceType: SERVICE_TYPE.POSTGRESQL,
          service: 'postgresql',
        },
        remoteServiceName,
      );
    }

    if (serviceType === 'mysql_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '3306',
        address: container,
        username: 'pmm',
        password: 'pmm',
        cluster: 'mysql_ssl_remote_cluster',
        environment: 'mysql_ssl_remote_cluster',
        tlsCAFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/mysql/${version}/ca.pem`),
        tlsKeyFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/mysql/${version}/client-key.pem`),
        tlsCertFile: await remoteInstancesPage.getFileContent(`/srv/qa-integration/pmm_qa/tls-ssl-setup/mysql/${version}/client-cert.pem`),
      };
      await addInstanceAPI.addMysqlSSL(details);
      I.wait(5);
      await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
        {
          serviceType: SERVICE_TYPE.MYSQL,
          service: 'mysql',
        },
        remoteServiceName,
      );
    }

    if (serviceType === 'mongodb_ssl') {
      details = {
        serviceName: remoteServiceName,
        serviceType,
        port: '27017',
        address: container,
        cluster: 'mongodb_ssl_remote_cluster',
        environment: 'mongodb_ssl_remote_cluster',
        tls_certificate_file_password: '',
        tls_certificate_key: await I.verifyCommand(`docker exec ${container} cat /mongodb_certs/client.pem`),
        tls_ca: await remoteInstancesPage.getFileContent('/srv/qa-integration/pmm_psmdb_diffauth_setup/pki/ca.crt'),
      };
      await addInstanceAPI.addMongoDBSSL(details);
      I.wait(5);
      await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
        {
          serviceType: SERVICE_TYPE.MONGODB,
          service: 'mongodb',
        },
        remoteServiceName,
      );
    }
  },
);

Data(sslinstances).Scenario(
  'Verify metrics from SSL instances on PMM-Server @post-ssl-upgrade',
  async ({
    I, current, grafanaAPI, inventoryAPI,
  }) => {
    const {
      serviceName, metric, databaseType,
    } = current;
    const remoteServiceName = `remote_api_${serviceName}`;

    // Waiting for metrics to start hitting for remotely added services
    I.wait(10);
    const apiServiceDetails = await inventoryAPI.getServiceDetailsByPartialName(serviceName);

    // verify metric for client container node instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_name', value: apiServiceDetails.service_name });

    // verify metric for remote instance
    await grafanaAPI.checkMetricExist(metric, { type: 'service_name', value: remoteServiceName });
  },
);

Data(sslinstances).Scenario(
  'Verify dashboard for SSL Instances and services after upgrade @post-ssl-upgrade',
  async ({
    I, dashboardPage, adminPage, current, inventoryAPI,
  }) => {
    const {
      databaseType, serviceName, dashboard,
    } = current;

    const apiServiceDetails = await inventoryAPI.getServiceDetailsByStartsWithName(serviceName);

    const serviceList = [apiServiceDetails.service_name, `remote_api_${serviceName}`];

    for (const service of serviceList) {
      const url = I.buildUrlWithParams(dashboard, { service_name: service, from: 'now-5m' });

      I.amOnPage(url);
      dashboardPage.waitForDashboardOpened();
      adminPage.performPageDown(5);
      await dashboardPage.expandEachDashboardRow();
      adminPage.performPageUp(5);
      await dashboardPage.verifyThereAreNoGraphsWithoutData(10);
    }
  },
).retry(1);

Data(sslinstances).Scenario(
  'Verify QAN after upgrade for SSL Instances added @post-ssl-upgrade',
  async ({
    I, queryAnalyticsPage, current, adminPage, inventoryAPI,
  }) => {
    const {
      serviceName,
    } = current;

    const apiServiceDetails = await inventoryAPI.getServiceDetailsByPartialName(serviceName);

    const serviceList = [apiServiceDetails.service_name, `remote_api_${serviceName}`];

    for (const service of serviceList) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
      queryAnalyticsPage.waitForLoaded();
      await adminPage.applyTimeRange('Last 5 minutes');
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilterInGroup(service, 'Service Name');
      queryAnalyticsPage.waitForLoaded();
      const count = await queryAnalyticsPage.data.getCountOfItems();

      assert.ok(count > 0, `The queries for service ${service} instance do NOT exist, check QAN Data`);
    }
  },
).retry(1);
