import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const serviceNamePrefix = 'pg-pagination-';

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  const api = new Api(page, page.request);

  for (let i = 1; i <= 26; i++) {
    await api.remoteInstanceApi.addRemoteInstance({
      postgresql: {
        add_node: { node_name: `${serviceNamePrefix}${i}`, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: 'localhost',
        cluster: 'pgsql_clstr',
        password: 'pmm-managed',
        pmm_agent_id: 'pmm-server',
        port: '5432',
        qan_postgresql_pgstatmonitor_agent: true,
        service_name: `${serviceNamePrefix}${i}`,
        tls_skip_verify: true,
        username: 'pmm-managed',
      },
    });
  }

  await page.close();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const api = new Api(page, page.request);
  const nodes = await api.inventoryApi.getAllNodes();

  for (const { node_id } of nodes.filter(({ node_name }) => node_name.startsWith(serviceNamePrefix))) {
    await api.inventoryApi.deleteNode(node_id, true);
  }

  await page.close();
});

for (const subPage of ['services', 'nodes'] as const) {
  pmmTest(
    `PMM-T1346 - Verify Inventory page has pagination on Services tab @inventory | ${subPage}`,
    async ({ nodesPage, page, servicesPage }) => {
      const { pagination, url } = subPage === 'services' ? servicesPage : nodesPage;

      await page.goto(url);
      await expect(pagination.itemsInterval).toContainText('1-25', { timeout: Timeouts.THIRTY_SECONDS });
      await pagination.verifyPaginationFunctionality();
    },
  );

  pmmTest(
    `PMM-T1441 - Check all checkboxes button should work fine for selected agents/nodes/services @inventory | ${subPage}`,
    async ({ nodesPage, page, servicesPage }) => {
      const inventoryPage = subPage === 'services' ? servicesPage : nodesPage;
      const { pagination } = inventoryPage;

      await page.goto(inventoryPage.url);

      const firstPageSelected = await pagination.selectAllRows();

      await pagination.nextPageButton.click();

      const selected = firstPageSelected + (await pagination.selectFirstRow());

      await inventoryPage.buttons.delete.click();
      await expect(inventoryPage.messages.deleteConfirmation).toHaveText(
        `Are you sure that you want to permanently delete ${selected} ${subPage}`,
      );
    },
  );

  pmmTest(
    `PMM-T1445 - Verification of Select all Functiality for multiple page @inventory | ${subPage}`,
    async ({ nodesPage, page, servicesPage }) => {
      const { pagination, url } = subPage === 'services' ? servicesPage : nodesPage;

      await page.goto(url);
      await pagination.selectAllRows();
      await expect(pagination.selectedRowCheckboxes).toHaveCount(
        Number(await pagination.rowsPerPageDropdown.textContent()),
      );
      await pagination.nextPageButton.click();
      await expect(pagination.selectedRowCheckboxes).toHaveCount(0);
    },
  );
}
