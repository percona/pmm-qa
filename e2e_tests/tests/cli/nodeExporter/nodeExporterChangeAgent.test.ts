import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('Tests to verify pmm-admin inventory change agent functionality', () => {
  pmmTest.describe.configure({ mode: 'serial' });

  let containerName: string;
  let nodeExporterId: string;
  let nodeId: string;

  pmmTest.beforeAll(async ({ cliHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep ps_pmm_`).stdout.trim();
    nodeExporterId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin list | grep node_exporter | awk -F' ' '{print $4}'`)
      .stdout.trim();
    nodeId = cliHelper
      .execSilent(`docker exec ${containerName} pmm-admin status | grep "Node ID" | awk -F' ' '{print $4}'`)
      .stdout.trim();
  });

  pmmTest(
    'PMM-T2271 - Verify pmm-admin inventory change agent flag custom labels @node-exporter-cli',
    async ({ agentsPage, cliHelper, grafanaHelper, page }) => {
      const label = 'env=qa_testing_node_exporter';

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin inventory change agent node-exporter ${nodeExporterId} --custom-labels=${label}`,
        )
        .assertSuccess();
      await grafanaHelper.authorize();
      await page.goto(agentsPage.nodeAgentsUrl(nodeId));
      await agentsPage.showRowDetails(nodeExporterId);
      await expect(agentsPage.builders.property(label)).toBeVisible();
    },
  );
});
