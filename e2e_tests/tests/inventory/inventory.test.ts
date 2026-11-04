import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus } from '@interfaces/inventory';
import { expect } from '@playwright/test';
import { inventoryServices } from '@testdata/remoteInstances';

let calls: { method: string; requestTime: Date; url: string }[] = [];
const dataTests = [
  { apiUrl: 'v1/ha/nodes', name: 'NodesPage' },
  { apiUrl: 'v1/management/services', name: 'ServicesPage' },
];
const remoteNodeNames = [
  'AgentToDelete',
  'NodeToDelete',
  'ServiceToDelete',
  'mongo_4.2_version_test',
  'pg_15_version_test',
  'ps_5.7_version_test',
];

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api }) => {
  const nodes = await api.inventoryApi.getAllNodes();

  for (const { node_id } of nodes.filter(({ node_name }) => remoteNodeNames.includes(node_name))) {
    await api.inventoryApi.deleteNode(node_id, true);
  }
});

for (const dataTest of dataTests) {
  pmmTest(
    `PMM-T2168 - Verify that ${dataTest.name} pages get data from BE every five seconds @inventory`,
    async ({ nodesPage, page, servicesPage }) => {
      page.on('request', (request) => {
        if (request.url().includes(dataTest.apiUrl)) {
          calls.push({
            method: request.method(),
            requestTime: new Date(),
            url: request.url(),
          });
        }
      });
      await page.goto(dataTest.name === 'NodesPage' ? nodesPage.url : servicesPage.url);
      await nodesPage.builders.showRowDetailsByIndex('0').click();
      await expect
        .poll(() => calls.length, {
          message: 'BE calls should be in the 5s interval!',
          timeout: Timeouts.TEN_SECONDS,
        })
        .toBeGreaterThanOrEqual(2);
      await expect(nodesPage.elements.detailsContent.first(), 'Page should not reload data!').toBeVisible();
      calls = [];

      page.on('request', (request) => {
        if (request.url().includes('v1/management/agents?')) {
          calls.push({
            method: request.method(),
            requestTime: new Date(),
            url: request.url(),
          });
        }
      });
      await nodesPage.elements.runningAgents.click();
      await nodesPage.builders.showRowDetailsByIndex('0').click();
      await expect
        .poll(() => calls.length, {
          message: 'BE calls should be in the 5s interval!',
          timeout: Timeouts.TEN_SECONDS,
        })
        .toBeGreaterThanOrEqual(2);
      await expect(nodesPage.elements.detailsContent.first(), 'Page should not reload data!').toBeVisible();
    },
  );
}

pmmTest(
  'PMM-T339 - Verify MySQL service is removed on PMM Inventory page @inventory',
  async ({ api, nodesPage, page, servicesPage }) => {
    const serviceName = 'ServiceToDelete';

    await api.remoteInstanceApi.addRemoteService({ ...inventoryServices.mysql, name: serviceName });

    const { service_id } = await api.inventoryApi.getServiceDetailsByRegex(`^${serviceName}$`);

    await page.goto(servicesPage.url);
    await servicesPage.deleteService(serviceName, false);
    await page.goto(servicesPage.url);
    await expect(servicesPage.builders.serviceRow(serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.deleteService(serviceName, true);
    await expect(servicesPage.builders.serviceRow(serviceName)).toBeHidden({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect
      .poll(() => api.inventoryApi.getServiceAgents(service_id), { message: 'The agents should be removed!' })
      .toEqual([]);
    await page.goto(nodesPage.url);
    await expect(nodesPage.builders.nodeRow(serviceName)).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
  },
);

pmmTest(
  'PMM-T340 - Verify node with agents, services can be removed on PMM Inventory page @inventory',
  async ({ api, nodesPage, page, servicesPage }) => {
    const serviceName = 'NodeToDelete';

    await api.remoteInstanceApi.addRemoteService({ ...inventoryServices.mysql, name: serviceName });

    const { service_id } = await api.inventoryApi.getServiceDetailsByRegex(`^${serviceName}$`);

    await page.goto(nodesPage.url);
    await nodesPage.deleteNode(serviceName);
    await page.goto(servicesPage.url);
    await expect(servicesPage.elements.serviceRows.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(servicesPage.builders.serviceRow(serviceName)).toBeHidden({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect
      .poll(() => api.inventoryApi.getServiceAgents(service_id), { message: 'The agents should be removed!' })
      .toEqual([]);
  },
);

pmmTest(
  'PMM-T1811 - verify version displayed for added service on Inventory page @inventory @inventory-fb',
  async ({ api, page, servicesPage }) => {
    const services = [
      { ...inventoryServices.mysql, name: 'ps_5.7_version_test' },
      { ...inventoryServices.mongodb, name: 'mongo_4.2_version_test' },
      { ...inventoryServices.postgresql, name: 'pg_15_version_test' },
    ];

    for (const service of services) {
      await api.remoteInstanceApi.addRemoteService(service);
    }

    await page.goto(servicesPage.url);

    for (const { name: serviceName } of services) {
      const { version } = await api.inventoryApi.getServiceDetailsByRegex(`^${serviceName}$`);

      expect(version, `${serviceName} should report the version of its database`).not.toEqual('');
      await servicesPage.verifyServiceLabels(serviceName, [`version=${version}`]);
    }
  },
);

pmmTest(
  'PMM-T342 - Verify pmm-server node cannot be removed from PMM Inventory page @inventory',
  async ({ nodesPage, page }) => {
    await page.goto(nodesPage.url);
    await expect(nodesPage.builders.nodeCheckbox('pmm-server')).toBeDisabled({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await nodesPage.builders.rowActions('pmm-server').click();
    await expect(nodesPage.buttons.overrideAlertThresholds).toBeVisible();
    await expect(nodesPage.buttons.deleteNode).toBeHidden();
    await expect(nodesPage.builders.nodeRow('pmm-server')).toBeVisible();
  },
);

pmmTest(
  'PMM-T343 - Verify agent can be removed on PMM Inventory page @inventory',
  async ({ agentsPage, api, page, servicesPage }) => {
    const serviceName = 'AgentToDelete';

    await api.remoteInstanceApi.addRemoteService({ ...inventoryServices.mysql, name: serviceName });

    const { service_id } = await api.inventoryApi.getServiceDetailsByRegex(`^${serviceName}$`);
    const nodesBefore = (await api.inventoryApi.getAllNodes()).length;

    await page.goto(agentsPage.serviceAgentsUrl(service_id));
    await agentsPage.deleteAgent('MySQL exporter');
    await expect(agentsPage.builders.agentTypeCell('MySQL exporter')).toBeHidden({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    expect(await api.inventoryApi.getAllNodes(), 'The count of nodes should be same!').toHaveLength(
      nodesBefore,
    );
    await page.goto(servicesPage.url);
    await expect(servicesPage.builders.serviceRow(serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T554 - Check that all agents have status "RUNNING" @inventory @nightly @gssapi-nightly @ami-ovf-pre-upgrade @ami-ovf-post-upgrade',
  async ({ api }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- skip-until: 2026-11-14 -- on HA, agent statuses go stale while pg-db restarts (PMM-15716); unskip once it is fixed.
    pmmTest.skip(await api.haApi.isEnabled(), 'Agent statuses go stale on HA, see PMM-15716');

    await expect(async () => {
      const agents = (await api.inventoryApi.getServices()).services
        .flatMap((service) => service.agents)
        .filter((agent) => agent.disabled === false);

      expect(agents.length, 'no enabled agents found').toBeGreaterThan(0);
      expect(
        {
          agentsNotRunning: agents.filter(
            (agent) => agent.agent_type !== 'pmm-agent' && agent.status !== AgentStatus.running,
          ),
          pmmAgentsNotConnected: agents.filter(
            (agent) => agent.agent_type === 'pmm-agent' && agent.is_connected !== true,
          ),
        },
        'Every pmm agent should be connected and every other agent running',
      ).toEqual({ agentsNotRunning: [], pmmAgentsNotConnected: [] });
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
  },
);

pmmTest(
  'PMM-T1226 - Verify Agents has process_exec_path option on Inventory page @inventory @nightly @gssapi-nightly @exporters',
  async ({ agentsPage, api, page }) => {
    if (!(await api.haApi.isEnabled())) {
      const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName('pmm-server-postgresql');

      await page.goto(agentsPage.serviceAgentsUrl(service_id));
      await agentsPage.verifyAgentDetailsLabel(
        'PostgreSQL exporter',
        'process_exec_path=/usr/local/percona/pmm/exporters/postgres_exporter',
      );
    }

    const exporters = Object.entries(await api.inventoryApi.getAgents())
      .filter(([agentType]) => agentType.endsWith('exporter') && agentType !== 'external_exporter')
      .flatMap(([agentType, agents]) => agents.map((agent) => ({ ...agent, agentType })));

    expect(exporters.length, 'no exporter agents found').toBeGreaterThan(0);
    expect(
      exporters.filter((exporter) => !exporter.process_exec_path),
      'process_exec_path value should not be empty',
    ).toEqual([]);
  },
);

pmmTest(
  'PMM-T1225 - Verify summary file includes process_exec_path for agents @mongodb-exporter',
  async ({ cliHelper }, testInfo) => {
    const exporters = cliHelper
      .getSummaryAgentsInfo('rs101', testInfo.outputPath('summary.zip'))
      .filter((agent) => !agent.agent_type.toLowerCase().includes('qan'));

    expect(exporters.length, 'pmm-admin summary should list exporters').toBeGreaterThan(0);
    expect(
      exporters.filter((agent) => !agent.process_exec_path),
      'Process exec path should be present for every exporter',
    ).toEqual([]);
  },
);

pmmTest(
  'PMM-T2024 - Verify services list does not refresh to first page @inventory-fb @nightly @gssapi-nightly',
  async ({ mocks, page, servicesPage }) => {
    await using servicesMock = await mocks.mockServicesList(50);

    await page.goto(servicesPage.url);
    await servicesPage.pagination.nextPageButton.click({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(servicesPage.pagination.activePageButton).toHaveText('2');

    const startServices = await servicesPage.getServiceNames();
    const requestsOnSecondPage = servicesMock.requests();

    expect(startServices, 'Page 2 should list services').not.toHaveLength(0);
    await expect
      .poll(() => servicesMock.requests(), {
        message: 'Services list should be refreshed from the backend',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toBeGreaterThanOrEqual(requestsOnSecondPage + 3);
    await expect
      .poll(() => servicesPage.getServiceNames(), {
        message: `List of displayed services after refresh should equal the list before: [${startServices}]`,
      })
      .toEqual(startServices);
    await expect
      .poll(() => servicesPage.elements.serviceRows.count(), {
        message: 'Expected number of rows to be less than 50',
      })
      .toBeLessThan(50);
  },
);

for (const tab of ['services', 'nodes'] as const) {
  pmmTest(
    `PMM-T2146 - Verify that all services/nodes have correct monitoring status @nightly | ${tab}`,
    async ({ api, nodesPage, page, servicesPage }) => {
      // eslint-disable-next-line playwright/no-skipped-test -- skip-until: 2026-11-14 -- on HA, agent statuses go stale while pg-db restarts (PMM-15716); unskip once it is fixed.
      pmmTest.skip(await api.haApi.isEnabled(), 'Agent statuses go stale on HA, see PMM-15716');

      const { pagination, url } = tab === 'services' ? servicesPage : nodesPage;

      await page.goto(url);
      await pagination.selectRowsPerPage('100');
      await expect(pagination.rowsPerPageDropdown).toHaveText('100');
      await pagination.verifyMonitoringStatusesOk(tab);
    },
  );
}
