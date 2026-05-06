const assert = require('assert');
const {
  SERVICE_TYPE, NODE_TYPE,
  AGENT_STATUS,
} = require('../helper/constants');

const {
  remoteInstancesPage, pmmInventoryPage, remoteInstancesHelper,
} = inject();

const externalExporterServiceName = 'external_service_new';
const haproxyServiceName = 'haproxy_remote';

const instances = new DataTable(['name']);
const qanFilters = new DataTable(['filterName']);

for (const [key, value] of Object.entries(remoteInstancesHelper.services)) {
  if (value) {
    switch (key) {
      case 'postgresql':
        // TODO: https://jira.percona.com/browse/PMM-9011
        // qanFilters.add([remoteInstancesPage.potgresqlSettings.environment]);
        break;
      case 'mysql':
        qanFilters.add([remoteInstancesPage.mysqlSettings.environment]);
        break;
      case 'postgresGC':
        qanFilters.add([remoteInstancesPage.postgresGCSettings.environment]);
        break;
      case 'mongodb':
        qanFilters.add([remoteInstancesPage.mongodbSettings.environment]);
        break;
      case 'proxysql':
        break;
      default:
    }
    instances.add([key]);
  }
}

const azureServices = new DataTable(['name', 'instanceToMonitor']);

if (remoteInstancesHelper.getInstanceStatus('azure').azure_mysql.enabled) {
  azureServices.add(['azure-MySQL', 'pmm2-qa-mysql']);
  qanFilters.add([remoteInstancesPage.mysqlAzureInputs.environment]);
}

if (remoteInstancesHelper.getInstanceStatus('azure').azure_postgresql.enabled) {
  azureServices.add(['azure-PostgreSQL', 'pmm2-qa-postgresql']);
  qanFilters.add([remoteInstancesPage.postgresqlAzureInputs.environment]);
}

const aws_instances = new DataTable(['service_name', 'password', 'instance_id', 'cluster_name']);

aws_instances.add([
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora2.address,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora2.password,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora2.instance_id,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora2.cluster_name,
]);
aws_instances.add([
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.address,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.password,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.instance_id,
  remoteInstancesHelper.remote_instance.aws.aurora.mysqlaurora3.cluster_name,
]);

Feature('Inventory page');

Before(async ({ I }) => {
  await I.Authorize();
});

// Skipping temporarily because sorting is not yet implemented in new Inventory page (PMM 2.37.0)
Scenario.skip(
  'PMM-T371 - Verify sorting in Inventory page(Services tab) @inventory @nightly',
  async ({ I, pmmInventoryPage }) => {
    I.amOnPage(pmmInventoryPage.url);
    await pmmInventoryPage.checkSort(4);
  },
);

Scenario.skip(
  'PMM-T371 - Verify sorting in Inventory page(Nodes tab) @inventory @nightly',
  async ({ I, pmmInventoryPage }) => {
    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.nodesLink, 20);
    I.click(pmmInventoryPage.fields.nodesLink);
    await pmmInventoryPage.checkSort(4);
  },
);

Scenario(
  'PMM-T339 - Verify MySQL service is removed on PMM Inventory page @inventory',
  async ({ I, addInstanceAPI, pmmInventoryPage }) => {
    const serviceType = 'MySQL';
    const serviceName = 'ServiceToDelete';

    await addInstanceAPI.apiAddInstance(serviceType, serviceName);
    I.amOnPage(pmmInventoryPage.url);
    const serviceId = pmmInventoryPage.getServicesId(serviceName);

    pmmInventoryPage.selectService(serviceName);
    I.click(pmmInventoryPage.fields.deleteButton);
    I.click(pmmInventoryPage.fields.proceedButton);
    pmmInventoryPage.serviceExists(serviceName, false);
    pmmInventoryPage.selectService(serviceName);
    pmmInventoryPage.deleteWithForceOpt();
    pmmInventoryPage.serviceExists(serviceName, true);
    I.click(pmmInventoryPage.fields.agentsLink);
    await pmmInventoryPage.getCountOfAgents(serviceId);
    I.click(pmmInventoryPage.fields.nodesLink);
    pmmInventoryPage.checkNodeExists(serviceName);
  },
);

Scenario(
  'PMM-T340 - Verify node with agents, services can be removed on PMM Inventory page @inventory',
  async ({ I, addInstanceAPI, pmmInventoryPage }) => {
    const serviceType = 'MySQL';
    const serviceName = 'NodeToDelete';

    await addInstanceAPI.apiAddInstance(serviceType, serviceName);
    I.amOnPage(pmmInventoryPage.url);
    const serviceId = pmmInventoryPage.getServicesId(serviceName);

    I.waitForVisible(pmmInventoryPage.fields.nodesLink, 30);
    I.click(pmmInventoryPage.fields.nodesLink);
    pmmInventoryPage.selectService(serviceName);
    pmmInventoryPage.deleteWithForceOpt();
    I.click(pmmInventoryPage.fields.pmmServicesSelector);
    pmmInventoryPage.serviceExists(serviceName, true);
    I.click(pmmInventoryPage.fields.agentsLink);
    await pmmInventoryPage.getCountOfAgents(serviceId);
  },
);

Scenario(
  'PMM-T1811 - verify version displayed for added service on Inventory page @inventory @inventory-fb',
  async ({
    I, pmmInventoryPage, addInstanceAPI,
  }) => {
    const psServiceName = 'ps_5.7_version_test';
    const rdsPostgresqlServiceName = 'pg_rds_version_test';
    const mongoServiceName = 'mongo_4.2_version_test';
    const pgServiceName = 'pg_15_version_test';

    await addInstanceAPI.addMysql(psServiceName);
    await addInstanceAPI.addMongodb(mongoServiceName);
    await addInstanceAPI.addPostgresql(pgServiceName);
    await addInstanceAPI.addRDSPostgresql(rdsPostgresqlServiceName);

    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.showServiceDetails(psServiceName), 20);

    I.click(pmmInventoryPage.fields.showServiceDetails(psServiceName));
    I.waitForVisible(pmmInventoryPage.fields.detailsLabelByText('version=5.7.30-33-log'), 5);
    I.click(pmmInventoryPage.fields.hideServiceDetails(psServiceName));

    I.click(pmmInventoryPage.fields.showServiceDetails(pgServiceName));
    I.waitForVisible(pmmInventoryPage.fields.detailsLabelByText('version=15.4 - Percona Distribution'), 5);
    I.click(pmmInventoryPage.fields.hideServiceDetails(pgServiceName));

    I.click(pmmInventoryPage.fields.showServiceDetails(mongoServiceName));
    I.waitForVisible(pmmInventoryPage.fields.detailsLabelByText('version=4.4.24'), 5);
    I.click(pmmInventoryPage.fields.hideServiceDetails(mongoServiceName));

    I.click(pmmInventoryPage.fields.showServiceDetails(rdsPostgresqlServiceName));
    I.waitForVisible(pmmInventoryPage.fields.detailsLabelByText('version=12.14'), 300);
    I.click(pmmInventoryPage.fields.hideServiceDetails(rdsPostgresqlServiceName));
  },
);

Scenario(
  'PMM-T342 - Verify pmm-server node cannot be removed from PMM Inventory page @inventory',
  async ({ I, pmmInventoryPage }) => {
    const node = 'pmm-server';

    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.nodesLink, 30);
    I.click(pmmInventoryPage.fields.nodesLink);
    pmmInventoryPage.selectService(node);
    pmmInventoryPage.deleteWithForceOpt();
    pmmInventoryPage.checkNodeExists(node);
  },
);

Scenario(
  'PMM-T343 - Verify agent can be removed on PMM Inventory page @inventory',
  async ({ I, pmmInventoryPage, addInstanceAPI }) => {
    const agentType = 'MySQL exporter';
    const serviceType = 'MySQL';
    const serviceName = 'AgentToDelete';

    await addInstanceAPI.apiAddInstance(serviceType, serviceName);
    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.nodesLink, 20);
    I.click(pmmInventoryPage.fields.nodesLink);
    const countOfNodesBefore = await pmmInventoryPage.getNodeCount();

    I.waitForVisible(pmmInventoryPage.fields.agentsLink, 20);
    I.click(pmmInventoryPage.fields.agentsLink);
    const serviceId = await pmmInventoryPage.getAgentServiceID(agentType);
    const agentId = await pmmInventoryPage.getAgentID(agentType);

    pmmInventoryPage.selectAgent(agentType);
    I.click(pmmInventoryPage.fields.deleteButton);
    I.click(pmmInventoryPage.fields.proceedButton);
    pmmInventoryPage.existsByid(agentId, true);
    I.click(pmmInventoryPage.fields.nodesLink);
    const countOfNodesAfter = await pmmInventoryPage.getNodeCount();

    pmmInventoryPage.verifyNodesCount(countOfNodesBefore, countOfNodesAfter);
    I.click(pmmInventoryPage.fields.pmmServicesSelector);
    pmmInventoryPage.existsByid(serviceId, false);
  },
);

Scenario.skip(
  'PMM-T345 - Verify removing pmm-agent on PMM Inventory page removes all associated agents @inventory',
  async ({ I, pmmInventoryPage }) => {
    const agentID = 'pmm-server';
    const agentType = 'PMM Agent';

    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.agentsLink, 20);
    I.click(pmmInventoryPage.fields.agentsLink);
    const countBefore = await pmmInventoryPage.getCountOfItems();

    pmmInventoryPage.selectAgentByID(agentID);
    pmmInventoryPage.deleteWithForceOpt();
    pmmInventoryPage.existsByid(agentID, false);
    pmmInventoryPage.selectAgent(agentType);
    const agentIDToDelete = await pmmInventoryPage.getAgentID(agentType);

    pmmInventoryPage.deleteWithForceOpt();
    pmmInventoryPage.existsByid(agentIDToDelete, true);
    await pmmInventoryPage.checkAllNotDeletedAgents(countBefore);
  },
);

Scenario(
  'PMM-T554 - Check that all agents have status "RUNNING" @inventory @nightly @gssapi-nightly @ami-ovf-pre-upgrade',
  async ({ I, pmmInventoryPage, inventoryAPI }) => {
    await I.amOnPage(pmmInventoryPage.url);
    await I.waitForVisible(pmmInventoryPage.fields.showRowDetails, 10);
    await pmmInventoryPage.servicesTab.pagination.selectRowsPerPage(50);

    const allAgents = [];

    Object.values((await inventoryAPI.apiGetServices()).data).flat(Infinity).forEach((o) => {
      allAgents.push(...o.agents);
    });

    const pmmAgents = allAgents.filter((o) => o.agent_type === 'pmm-agent');
    const otherAgents = allAgents.filter((o) => o.agent_type !== 'pmm-agent' && o.agent_type !== 'external-exporter');

    const pmmAgentsNotConnected = pmmAgents.filter((o) => o.is_connected !== true);
    const agentsNotRunning = otherAgents.filter((o) => o.status !== AGENT_STATUS.RUNNING);

    const errors = [];

    try {
      assert.ok(!pmmAgentsNotConnected.length, 'Not all pmm agents are connected');
    } catch (e) {
      errors.push({
        message: 'Not all pmm agents are connected',
        agents: pmmAgentsNotConnected,
      });
    }

    try {
      assert.ok(!agentsNotRunning.length, 'Not all agents are running');
    } catch (e) {
      errors.push({
        message: 'Not all agents are running',
        agents: agentsNotRunning,
      });
    }

    assert.ok(errors.length === 0, `Errors found: \n${JSON.stringify(errors, null, 2)}`);
  },
);

Scenario(
  'PMM-T1226 - Verify Agents has process_exec_path option on Inventory page @inventory @nightly @gssapi-nightly @exporters',
  async ({ I, pmmInventoryPage, inventoryAPI }) => {
    I.amOnPage(pmmInventoryPage.url);
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pmm-server-postgresql');

    await pmmInventoryPage.openAgents(service_id);
    await pmmInventoryPage.checkAgentOtherDetailsSection('Postgres exporter', 'process_exec_path=/usr/local/percona/pmm/exporters/postgres_exporter');

    const actAg = await inventoryAPI.apiGetAgents();
    const arr = [];

    for (const key of Object.keys(actAg.data)) {
      if (key.endsWith('exporter') && key !== 'external_exporter') {
        // eslint-disable-next-line no-return-assign
        actAg.data[key].map((o) => o.type = key);

        arr.push(...actAg.data[key]);
      }
    }

    assert.ok(arr.length, 'no exporter agents found');

    for (const key of arr) {
      await I.say(JSON.stringify(key, null, 2));
      assert.ok(key.process_exec_path, `process_exec_path value is empty for ${key.type}`);
    }
  },
);

// the test relies on --database psmdb
Scenario(
  'PMM-T1225 - Verify summary file includes process_exec_path for agents @mongodb-exporter',
  async ({ I, pmmInventoryPage }) => {
    I.amOnPage(pmmInventoryPage.url);
    const response = await I.verifyCommand('docker exec rs101 pmm-admin summary');
    const zipFileName = response.split(' ')[0];

    await I.verifyCommand(`docker cp rs101:/${zipFileName} ./summary.zip`);
    const statusFile = JSON.parse(await I.readFileInZipArchive('summary.zip', 'client/status.json'));
    const exporters = statusFile.agents_info.filter((agent) => !agent.agent_type.toLowerCase().includes('qan'));

    I.amOnPage(pmmInventoryPage.url);

    exporters.forEach((agent) => {
      if (agent.process_exec_path) {
        I.say(`process_exec_path for agent ${agent.agent_type} is ${agent.process_exec_path}`);
        assert.ok(agent.process_exec_path.length, `Process exec path for ${agent.agent_type} is empty`);
      } else {
        assert.fail(`Process exec path is not present for ${agent.agent_type}`);
      }
    });
  },
);

Data(instances).Scenario(
  'PMM-T2340 - Verify Remote Instances can be created and edited [critical] @inventory @inventory-fb',
  async ({
    I, pmmInventoryPage, current,
  }) => {
    const serviceName = remoteInstancesHelper.services[current.name];

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage(current.name);
    const inputs = await remoteInstancesPage.fillRemoteFields(serviceName);

    remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);

    const newLabels = {
      environment: `${inputs.environment} edited` || `${serviceName} environment edited`,
      cluster: `${inputs.cluster} edited` || `${serviceName} cluster edited`,
      replicationSet: `${inputs.replicationSet} edited` || `${serviceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(serviceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(serviceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
);

Scenario(
  'PMM-T2340 - Verify adding and editing external exporter service via UI @inventory @inventory-fb',
  async ({ I, remoteInstancesPage, pmmInventoryPage }) => {
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('external');
    const inputs = await remoteInstancesPage.fillRemoteFields(externalExporterServiceName);

    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(externalExporterServiceName);
    const newLabels = {
      environment: `${inputs.environment} edited` || `${externalExporterServiceName} environment edited`,
      cluster: `${inputs.cluster} edited` || `${externalExporterServiceName} cluster edited`,
      replicationSet: `${inputs.replicationSet} edited` || `${externalExporterServiceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(externalExporterServiceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(externalExporterServiceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
).retry(0);

Scenario(
  'PMM-T2340 - Verify adding and editing RDS instances [critical] @inventory @inventory-fb',
  async ({ I, remoteInstancesPage, pmmInventoryPage }) => {
    const serviceName = remoteInstancesPage.mysql57rds['Service Name'];
    const nodeName = 'pmm-server';

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.verifyInstanceIsDiscovered(serviceName);
    remoteInstancesPage.startMonitoringOfInstance(serviceName);
    remoteInstancesPage.verifyAddInstancePageOpened();
    const inputs = await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);

    remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
    const newLabels = {
      environment: `${inputs.environment} edited` || `${serviceName} environment edited`,
      cluster: `${inputs.cluster} edited` || `${serviceName} cluster edited`,
      replicationSet: `${inputs.replicationSet} edited` || `${serviceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(serviceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(serviceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
);

Scenario(
  '@PMM-T2340 - Verify Adding and Editing HAProxy service via UI @inventory @inventory-fb',
  async ({
    I, remoteInstancesPage, pmmInventoryPage,
  }) => {
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('haproxy');
    I.waitForVisible(remoteInstancesPage.fields.hostName, 30);
    I.fillField(
      remoteInstancesPage.fields.hostName,
      remoteInstancesHelper.remote_instance.haproxy.haproxy_2.host,
    );
    I.fillField(remoteInstancesPage.fields.serviceName, haproxyServiceName);
    I.clearField(remoteInstancesPage.fields.portNumber);
    I.fillField(
      remoteInstancesPage.fields.portNumber,
      remoteInstancesHelper.remote_instance.haproxy.haproxy_2.port,
    );
    I.scrollPageToBottom();
    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(haproxyServiceName);
    const newLabels = {
      environment: `${remoteInstancesHelper.remote_instance.haproxy.environment} edited` || `${haproxyServiceName} environment edited`,
      cluster: `${remoteInstancesHelper.remote_instance.haproxy.clusterName} edited` || `${haproxyServiceName} cluster edited`,
      replicationSet: `${remoteInstancesHelper.remote_instance.haproxy.replicationSet} edited` || `${haproxyServiceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(haproxyServiceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(haproxyServiceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
);

Scenario(
  'PMM-T2340 - Verify adding and editing PostgreSQL RDS monitoring to PMM via UI @inventory @inventory-fb',
  async ({
    I, remoteInstancesPage, pmmInventoryPage,
  }) => {
    const serviceName = 'pmm-qa-pgsql-12';
    const nodeName = 'pmm-server';

    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilRemoteInstancesPageLoaded().openAddAWSRDSMySQLPage();
    remoteInstancesPage.discoverRDS();
    remoteInstancesPage.verifyInstanceIsDiscovered(serviceName);
    remoteInstancesPage.startMonitoringOfInstance(serviceName);
    remoteInstancesPage.verifyAddInstancePageOpened();
    const grabbedHostname = await I.grabValueFrom(remoteInstancesPage.fields.hostName);

    assert.ok(grabbedHostname.startsWith(serviceName), `Hostname is incorrect: ${grabbedHostname}`);
    I.seeInField(remoteInstancesPage.fields.serviceName, serviceName);
    const inputs = await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);

    remoteInstancesPage.createRemoteInstance(serviceName);
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
    const newLabels = {
      environment: `${inputs.environment} edited` || `${serviceName} environment edited`,
      cluster: `${inputs.cluster} edited` || `${serviceName} cluster edited`,
      replicationSet: `${inputs.replicationSet} edited` || `${serviceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(serviceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(serviceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
);

Data(azureServices).Scenario(
  'PMM-T2340 - Verify adding and editing monitoring for Azure @inventory @inventory-fb',
  async ({
    I, remoteInstancesPage, pmmInventoryPage, settingsAPI, current,
  }) => {
    const serviceName = current.name;
    const nodeName = 'pmm-server';

    await settingsAPI.enableAzure();
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.openAddAzure();
    remoteInstancesPage.discoverAzure();
    remoteInstancesPage.startMonitoringOfInstance(current.instanceToMonitor);
    remoteInstancesPage.verifyAddInstancePageOpened();
    const inputs = await remoteInstancesPage.fillRemoteRDSFields(serviceName, nodeName);

    await remoteInstancesPage.clickAddInstanceAndWaitForSuccess();
    pmmInventoryPage.verifyRemoteServiceIsDisplayed(serviceName);
    const newLabels = {
      environment: `${inputs.environment} edited` || `${serviceName} environment edited`,
      cluster: `${inputs.cluster} edited` || `${serviceName} cluster edited`,
      replicationSet: `${inputs.replicationSet} edited` || `${serviceName} replicationSet edited`,
    };

    pmmInventoryPage.openEditServiceWizard(serviceName);
    pmmInventoryPage.updateServiceLabels(newLabels);
    I.click(pmmInventoryPage.fields.showServiceDetails(serviceName));
    pmmInventoryPage.verifyServiceLabels(newLabels);
  },
);

Data(aws_instances).Scenario('PMM-T2340 Verify adding and editing Aurora remote instance @inventory @inventory-fb', async ({
  I, addInstanceAPI, current,
}) => {
  const {
    service_name, password, instance_id, cluster_name,
  } = current;
  const nodeName = 'pmm-server';
  const details = {
    add_node: {
      node_name: service_name,
      node_type: NODE_TYPE.REMOTE,
    },
    aws_access_key: remoteInstancesHelper.remote_instance.aws.aurora.aws_access_key,
    aws_secret_key: remoteInstancesHelper.remote_instance.aws.aurora.aws_secret_key,
    address: service_name,
    service_name: instance_id,
    port: remoteInstancesHelper.remote_instance.aws.aurora.port,
    username: remoteInstancesHelper.remote_instance.aws.aurora.username,
    password,
    instance_id,
    cluster: cluster_name,
  };

  await addInstanceAPI.addRDS(details.service_name, details);

  I.amOnPage(pmmInventoryPage.url);
  pmmInventoryPage.verifyRemoteServiceIsDisplayed(details.service_name);
  const newLabels = {
    environment: `${details.environment} edited` || `${details.service_name} environment edited`,
    cluster: `${details.cluster} edited` || `${details.service_name} cluster edited`,
    replicationSet: `${details.replicationSet} edited` || `${details.service_name} replicationSet edited`,
  };

  pmmInventoryPage.openEditServiceWizard(details.service_name);
  pmmInventoryPage.updateServiceLabels(newLabels);
  I.click(pmmInventoryPage.fields.showServiceDetails(details.service_name));
  pmmInventoryPage.verifyServiceLabels(newLabels);
});

Data(qanFilters).Scenario(
  'PMM-T2340 - Verify QAN after remote instance is added @inventory @inventory-fb',
  async ({
    I, current, queryAnalyticsPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(current.filterName);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for filter ${current.filterName} instance do NOT exist`);
  },
).retry(2);

Data(aws_instances).Scenario(
  'PMM-T2340 Verify QAN after Aurora instance is added and edited @inventory @inventory-fb',
  async ({
    I, queryAnalyticsPage, current, adminPage,
  }) => {
    const { instance_id } = current;

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    await adminPage.applyTimeRange('Last 12 hours');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectFilter(instance_id);
    queryAnalyticsPage.waitForLoaded();
    const count = await queryAnalyticsPage.data.getCountOfItems();

    assert.ok(count > 0, `The queries for service ${instance_id} instance do NOT exist, check QAN Data`);
  },
).retry(1);

Scenario('PMM-T2024 - Verify services list does not refresh to first page @inventory-fb @nightly @gssapi-nightly', async ({ I, pmmInventoryPage }) => {
  I.usePlaywrightTo('Mock Services List', async ({ page }) => {
    const mockedServices = { services: [] };

    for (let i = 1; i <= 50; i++) {
      mockedServices.services.push({
        address: `127.0.0.${i}`,
        agents: [],
        cluster: '',
        custom_labels: {},
        database_name: 'postgres',
        environment: '',
        external_group: '',
        node_id: 'pmm-server',
        node_name: `mocked-service-node-${i}`,
        port: 5432,
        replication_set: '',
        service_id: `30edfcf1-bea1-4422-b111-d2d263bdcfc${i}`,
        service_name: `mocked-service-${i}`,
        service_type: 'postgresql',
        socket: '',
        status: 'STATUS_UP',
        version: '',
      });
    }

    await page.route('**/v1/management/services', (route) => route.fulfill({
      status: 200,
      body: JSON.stringify(mockedServices),
    }));
  });

  pmmInventoryPage.open();
  I.click(pmmInventoryPage.pagination.elements.pageNumberButton('2'));
  const startServices = await I.grabTextFromAll(pmmInventoryPage.fields.serviceNames);

  I.wait(15);
  const numberOfRows = await I.grabNumberOfVisibleElements(pmmInventoryPage.fields.tableRow);

  I.assertTrue(
    await pmmInventoryPage.verifyDisplayedServices(startServices),
    `List of displayed services after wait does not equal list of displayed services before wait: [${startServices}]`,
  );
  I.assertTrue(numberOfRows < 50, `Expected number of rows to be less than 25, actual number of rows is: ${numberOfRows}`);
});
