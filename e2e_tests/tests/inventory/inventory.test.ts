import apiEndpoints from '@helpers/apiEndpoints';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus } from '@interfaces/inventory';
import { expect } from '@playwright/test';

let calls: { method: string; requestTime: Date; url: string }[] = [];
const dataTests = [
  { apiUrl: 'v1/ha/nodes', name: 'NodesPage' },
  { apiUrl: 'v1/management/services', name: 'ServicesPage' },
];

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
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
  'PMM-T554 - Check that all agents have status "RUNNING" @inventory @nightly @gssapi-nightly',
  async ({ api }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- skip-until: 2026-11-14 -- on HA, agent statuses go stale while pg-db restarts (PMM-15716); unskip once it is fixed.
    pmmTest.skip(await api.haApi.isEnabled(), 'Agent statuses go stale on HA, see PMM-15716');

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
  },
);

pmmTest(
  'PMM-T1226 - Verify Agents has process_exec_path option on Inventory page @inventory @nightly @gssapi-nightly @exporters',
  async ({ agentsPage, api, page, request }) => {
    if (!(await api.haApi.isEnabled())) {
      const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName('pmm-server-postgresql');

      await page.goto(agentsPage.serviceAgentsUrl(service_id));
      await agentsPage.verifyAgentDetailsLabel(
        'PostgreSQL exporter',
        'process_exec_path=/usr/local/percona/pmm/exporters/postgres_exporter',
      );
    }

    const response = await request.get(apiEndpoints.inventory.agents, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    const exporters = Object.entries(
      (await response.json()) as Record<string, { process_exec_path: string }[]>,
    )
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
