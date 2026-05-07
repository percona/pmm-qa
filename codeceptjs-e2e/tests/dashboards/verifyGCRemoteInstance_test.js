const assert = require('assert');

const { remoteInstancesHelper } = inject();

Feature('Monitoring Mysql and Postgresql DB running on Google Cloud');

const instances = new DataTable(['instance', 'instanceType', 'metric']);

instances.add(['pgsql13', 'postgresql', 'pg_stat_database_xact_rollback']);
instances.add(['pgsql14', 'postgresql', 'pg_stat_database_xact_rollback']);
instances.add(['pgsql15', 'postgresql', 'pg_stat_database_xact_rollback']);
instances.add(['pgsql16', 'postgresql', 'pg_stat_database_xact_rollback']);
instances.add(['pgsql17', 'postgresql', 'pg_stat_database_xact_rollback']);
instances.add(['mysql57', 'mysql', 'mysql_global_status_max_used_connections']);
instances.add(['mysql80', 'mysql', 'mysql_global_status_max_used_connections']);
instances.add(['mysql84', 'mysql', 'mysql_global_status_max_used_connections']);

// Mapping here to avoid datatables to add those details to test names in allure report
const remoteInstance = {
  pgsql13: remoteInstancesHelper.remote_instance.gc.gc_pgsql_13,
  pgsql14: remoteInstancesHelper.remote_instance.gc.gc_pgsql_14,
  pgsql15: remoteInstancesHelper.remote_instance.gc.gc_pgsql_15,
  pgsql16: remoteInstancesHelper.remote_instance.gc.gc_pgsql_16,
  pgsql17: remoteInstancesHelper.remote_instance.gc.gc_pgsql_17,
  mysql57: remoteInstancesHelper.remote_instance.gc.gc_mysql57,
  mysql80: remoteInstancesHelper.remote_instance.gc.gc_mysql80,
  mysql84: remoteInstancesHelper.remote_instance.gc.gc_mysql84,
};

function getInstance(key) {
  return remoteInstance[key];
}

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'Increasing Scrape Interval to Rare for remote pgsql instances bug @not-ui-pipeline @gcp',
  async ({ settingsAPI }) => {
    const body = {
      telemetry_enabled: true,
      metrics_resolutions: {
        hr: '60s',
        mr: '180s',
        lr: '300s',
      },
      data_retention: '172800s',
    };

    await settingsAPI.changeSettings(body, true);
  },
);

Data(instances).Scenario(
  'Verify adding Remote Google Cloud Instance @not-ui-pipeline @gcp',
  async ({
    I, remoteInstancesPage, current,
  }) => {
    const {
      instance, instanceType,
    } = current;

    const instanceDetails = getInstance(instance);

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage(instanceType);
    await remoteInstancesPage.addRemoteDetails(instanceDetails);
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
  },
);

Data(instances).Scenario(
  'Verify Remote Instance Google Cloud Instance has Status Running @not-ui-pipeline @gcp',
  async ({
    I, pmmInventoryPage, current,
  }) => {
    const {
      instance,
    } = current;

    const instanceDetails = getInstance(instance);

    I.amOnPage(pmmInventoryPage.url);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(instanceDetails.serviceName);
    await pmmInventoryPage.verifyAgentHasStatusRunning(instanceDetails.serviceName);
    // Waiting for metrics to start hitting PMM-Server
    I.wait(20);
  },
).retry(2);

Data(instances).Scenario(
  'Verify dashboard after Remote GC Instances are added @not-ui-pipeline @gcp',
  async ({
    I, dashboardPage, adminPage, current,
  }) => {
    const {
      instance, instanceType,
    } = current;

    const instanceDetails = getInstance(instance);

    I.wait(30);
    if (instanceType === 'mysql') {
      I.amOnPage(I.buildUrlWithParams(dashboardPage.mySQLInstanceOverview.clearUrl, {
        service_name: instanceDetails.serviceName,
        from: 'now-5m',
      }));
    }

    if (instanceType === 'postgresql') {
      I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceOverviewDashboard.url, {
        service_name: instanceDetails.serviceName,
        from: 'now-5m',
      }));
    }

    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(6);
  },
).retry(2);

// skipping mysql gc because of PMM-9389
Data(instances).Scenario(
  'Verify QAN after remote Google Cloud instance is added @not-ui-pipeline @gcp',
  async ({
    I, current, queryAnalyticsPage,
  }) => {
    const {
      instance,
    } = current;

    const instanceDetails = getInstance(instance);

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(instanceDetails.serviceName);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${instanceDetails.serviceName} instance do NOT exist`);
  },
).retry(1);

Data(instances).Scenario(
  'Check metrics from exporters are hitting PMM Server @not-ui-pipeline @gcp',
  async ({ I, grafanaAPI, current }) => {
    const {
      instance, metric,
    } = current;

    const instanceDetails = getInstance(instance);

    I.wait(30);
    await grafanaAPI.checkMetricExist(metric, { type: 'service_name', value: instanceDetails.serviceName });
  },
);

Scenario(
  'Setting back to default Scrape Interval @not-ui-pipeline @gcp',
  async ({ settingsAPI }) => {
    const body = {
      telemetry_enabled: true,
      metrics_resolutions: settingsAPI.defaultResolution,
      data_retention: '172800s',
    };

    await settingsAPI.changeSettings(body, true);
  },
);
