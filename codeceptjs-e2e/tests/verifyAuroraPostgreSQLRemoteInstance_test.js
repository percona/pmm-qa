const assert = require('assert');
const { SERVICE_TYPE, AGENT_NAMES } = require('./helper/constants');

const { remoteInstancesHelper, pmmInventoryPage } = inject();

Feature('Monitoring Aurora PostgreSQL instances');

const instances = ['postgres15aurora', 'postgres16aurora'];

Before(async ({ I }) => {
  await I.Authorize();
});

Data(instances).Scenario(
  'PMM-T2010 - Verify adding Aurora PostgreSQL RDS with specified Auto-discovery limit @aws @instances',
  async ({
    I, current, remoteInstancesPage, pmmInventoryPage, inventoryAPI, agentsPage,
  }) => {
    const serviceName = remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id;
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

    await remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
  },
).retry(1);

Data(instances).Scenario(
  'PMM-T2010 - Verify Aurora PostgreSQL RDS with specified Auto-discovery limit @aws @instances',
  async ({
    I, current, inventoryAPI, agentsPage,
  }) => {
    const serviceName = remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id;
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);

    await agentsPage.open(service_id);
    await agentsPage.verifyAgentOtherDetailsSection(AGENT_NAMES.POSTGRESQL_EXPORTER, 'auto_discovery_limit=1');

    const agentId = await I.grabTextFrom(agentsPage.fields.agentIdByAgentName(AGENT_NAMES.POSTGRESQL_EXPORTER));

    I.wait(3);

    const out = await I.verifyCommand(`docker top pmm-server | awk '/postgres_exporter/ && /${agentId.split('/')[2]}/'`);

    assert(!out.includes('--auto-discover-databases'), 'postgres-exporter should not have flag "auto-discover-databases"');
  },
);

Data(instances).Scenario(
  'PMM-T2010 - Verify Dashboard for Aurora Postgres RDS added via UI @aws @instances',
  async ({
    I, current, dashboardPage, settingsAPI, qanAPI,
  }) => {
    const {
      instance,
    } = current;

    const serviceName = remoteInstancesHelper.remote_instance.aws.aurora[current].instance_id;

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
    // Execution time comes from QAN, which sends its first bucket at the first minute boundary after the agent starts.
    await I.asyncWaitFor(async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 5 * 60 * 1000);
      const { data } = await qanAPI.getMetricByFilterAPI(serviceName, 'service_name', [], from.toISOString(), to.toISOString());

      return Number(data?.metrics?.num_queries?.sum) > 0;
    }, 180, `QAN has no data for ${serviceName}`);
    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceOverviewDashboard.url, {
      service_name: serviceName,
      from: 'now-5m',
    }));
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);
