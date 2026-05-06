const assert = require('assert');
const { SERVICE_TYPE } = require('./helper/constants');

const { remoteInstancesPage } = inject();

Feature('Monitoring AWS RDS PostgreSQL');

Before(async ({ I }) => {
  await I.Authorize();
});

const instances = new DataTable(['instance', 'instanceType']);

instances.add(['postgresql13', 'postgres']);
instances.add(['postgresql14', 'postgres']);
instances.add(['postgresql15', 'postgres']);
instances.add(['postgresql16', 'postgres']);
instances.add(['postgresql17', 'postgres']);

// Mapping here to avoid datatables to add those details to test names in allure report
const remoteInstance = {
  postgresql13: remoteInstancesPage.postgresql13rds,
  postgresql14: remoteInstancesPage.postgresql14rds,
  postgresql15: remoteInstancesPage.postgresql15rds,
  postgresql16: remoteInstancesPage.postgresql16rds,
  postgresql17: remoteInstancesPage.postgresql17rds,
};

function getInstance(key) {
  return remoteInstance[key];
}

After(async ({ settingsAPI }) => {
  if (process.env.OVF_TEST === 'yes') {
    const body = {
      metrics_resolutions: {
        hr: '5s',
        mr: '10s',
        lr: '60s',
      },
    };

    await settingsAPI.changeSettings(body, true);
  }
});

Data(instances).Scenario(
  'PMM-T1831 - Verify adding PostgreSQL RDS with specified Auto-discovery limit @aws @instances',
  async ({
    I, current, remoteInstancesPage, pmmInventoryPage, inventoryAPI, agentsPage,
  }) => {
    const {
      instance,
    } = current;

    const serviceName = getInstance(instance)['Service Name'];
    const nodeName = 'pmm-server';

    await inventoryAPI.deleteNodeByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.startMonitoringOfInstance(serviceName);
    remoteInstancesPage.verifyAddInstancePageOpened();
    I.seeInField(remoteInstancesPage.fields.serviceName, serviceName);
    await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);
    I.click(remoteInstancesPage.fields.customAutoDiscoveryButton);
    I.clearField(remoteInstancesPage.fields.customAutoDiscoveryfield);
    I.fillField(remoteInstancesPage.fields.customAutoDiscoveryfield, '1');

    remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);

    await agentsPage.open(service_id);
    await agentsPage.verifyAgentOtherDetailsSection('Postgres exporter', 'auto_discovery_limit=1');

    const agentId = await I.grabTextFrom(agentsPage.fields.agentIdByAgentName('Postgres exporter'));

    I.wait(3);

    const out = await I.verifyCommand(`docker top pmm-server | awk '/postgres_exporter/ && /${agentId.split('/')[2]}/'`);

    assert(!out.includes('--auto-discover-databases'), 'postgres-exporter should not have flag "auto-discover-databases"');
  },
);

Data(instances).Scenario(
  'PMM-T716 + PMM-T1596 - Verify adding PostgreSQL RDS monitoring to PMM via UI @aws @instances'
  + 'Verify that PostgreSQL exporter ignores connection error to "rdsadmin" database for Amazon RDS instance @aws @instances',
  async ({
    I, current, remoteInstancesPage, pmmInventoryPage, inventoryAPI,
  }) => {
    const {
      instance,
    } = current;

    const serviceName = getInstance(instance)['Service Name'];
    const nodeName = 'pmm-server';

    await inventoryAPI.deleteNodeByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.verifyInstanceIsDiscovered(serviceName);
    remoteInstancesPage.startMonitoringOfInstance(serviceName);
    remoteInstancesPage.verifyAddInstancePageOpened();
    const grabbedHostname = await I.grabValueFrom(remoteInstancesPage.fields.hostName);

    assert.ok(grabbedHostname.startsWith(serviceName), `Hostname is incorrect: ${grabbedHostname}`);
    I.seeInField(remoteInstancesPage.fields.serviceName, serviceName);
    await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);
    remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
    // Skipping due to QAN Setup part on AWS
    // await pmmInventoryPage.verifyAgentHasStatusRunning(serviceName);

    // await pmmInventoryPage.verifyMetricsFlags(serviceName);
    const logs = await I.verifyCommand('docker exec pmm-server cat /srv/logs/pmm-agent.log | awk \'/postgres_exporter/ && /ERRO/ && /opening connection/ && /rdsadmin/\'');

    assert.ok(!logs, `Logs contains errors about rdsadmin database being used! \n The lines are: \n ${logs}`);
  },
);

Data(instances).Scenario(
  'PMM-T716 - Verify Dashboard for Postgres RDS added via UI @aws @instances',
  async ({
    I, current, dashboardPage, settingsAPI,
  }) => {
    const {
      instance,
    } = current;

    const serviceName = getInstance(instance)['Service Name'];

    // Increase resolution to avoid failures for OVF execution
    if (process.env.OVF_TEST === 'yes') {
      const body = {
        metrics_resolutions: {
          hr: '60s',
          mr: '180s',
          lr: '300s',
        },
      };

      await settingsAPI.changeSettings(body, true);
    }

    // Wait 10 seconds before test to start getting metrics
    I.wait(10);
    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceOverviewDashboard.cleanUrl, {
      node_name: serviceName,
      from: 'now-5m',
    }));
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
).retry(2);

// Skip due to PGSQL instance setup on AWS
xScenario(
  'PMM-T716 - Verify QAN for Postgres RDS added via UI @aws @instances',
  async ({
    I, queryAnalyticsPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter('RDS Postgres');
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, 'The queries for added RDS Postgres do NOT exist');
  },
).retry(2);
