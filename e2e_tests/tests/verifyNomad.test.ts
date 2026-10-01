import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ api, baseURL, grafanaHelper }) => {
  await api.settingsApi.setPublicAddress(new URL('/', baseURL).hostname);
  await api.serverApi.waitForReady();
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api }) => {
  await api.settingsApi.setPublicAddress('');
  await api.serverApi.waitForReady();
});

pmmTest(
  'PMM-T2026 - Verify nomad client is not running if Nomad server is stopped @nomad',
  async ({ agentsPage, api, nodesPage, page }) => {
    await page.goto(nodesPage.url);

    await pmmTest.step('Show 100 nodes per page', async () => {
      await nodesPage.pagination.selectRowsPerPage('100');
      await expect(nodesPage.pagination.rowsPerPageDropdown).toHaveText('100', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await expect(nodesPage.elements.nodeRows).not.toHaveCount(0);

    const nodeCount = await nodesPage.elements.nodeRows.count();

    await pmmTest.step('Verify every node runs the Nomad agent', async () => {
      for (let index = 0; index < nodeCount; index++) {
        await nodesPage.builders.monitoringLinkByIndex(index).click();
        await expect(agentsPage.buttons.backToNodes).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(agentsPage.elements.agentTypes).not.toHaveCount(0);
        await expect(agentsPage.builders.agentTypeCell('Nomad agent')).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await agentsPage.buttons.backToNodes.click();
      }
    });

    await api.settingsApi.setPublicAddress('');
    await api.serverApi.waitForReady();

    await pmmTest.step('Verify no node runs the Nomad agent', async () => {
      for (let index = 0; index < nodeCount; index++) {
        await nodesPage.builders.monitoringLinkByIndex(index).click();
        await expect(agentsPage.buttons.backToNodes).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(agentsPage.elements.agentTypes).not.toHaveCount(0);
        await expect(agentsPage.builders.agentTypeCell('Nomad agent')).toBeHidden({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await agentsPage.buttons.backToNodes.click();
      }
    });
  },
);
