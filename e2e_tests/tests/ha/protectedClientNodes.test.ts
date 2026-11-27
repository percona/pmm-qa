import pmmTest from '@fixtures/pmmTest';
import { APIResponse, expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

const expectRefused = async (response: APIResponse, message: string): Promise<void> => {
  const body = await response.text();

  expect(response.status(), body).toEqual(400);
  expect(body).toContain(message);
};

pmmTest(
  'PMM-T2914 - Verify the Nodes of the pmm-ha-client pods cannot be deleted from the UI or the API @pmm-ha',
  async ({ api, haClusterHelper, nodesPage, page }) => {
    // Names come from the cluster, not the API under test. PMM protects a Node only while its pmm-agent is connected.
    const clientNodes = await pmmTest.step(
      'Wait for every PMM Client pod to connect its pmm-agent',
      async () => {
        const nodeNames = haClusterHelper.clientNodeNames();

        expect(nodeNames.length, 'The pmm-ha chart runs PMM Client pods').toBeGreaterThan(0);

        let connected: { nodeId: string; nodeName: string; pmmAgentId: string }[] = [];

        await expect(async () => {
          const registered = await api.inventoryApi.getAllNodes();

          connected = nodeNames.map((nodeName) => {
            const node = registered.find(({ node_name }) => node_name === nodeName);
            const pmmAgent = node?.agents?.find(({ agent_type }) => agent_type === 'pmm-agent');

            if (!node || !pmmAgent?.is_connected) {
              throw new Error(`The pmm-agent of PMM Client pod Node "${nodeName}" is not connected`);
            }

            return { nodeId: node.node_id, nodeName, pmmAgentId: pmmAgent.agent_id };
          });
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

        return connected;
      },
    );

    await page.goto(nodesPage.url);

    for (const { nodeName } of clientNodes) {
      await pmmTest.step(`Verify "${nodeName}" cannot be selected for deletion`, async () => {
        await expect(
          nodesPage.builders.nodeCheckbox(nodeName),
          `"${nodeName}" belongs to a running PMM Client pod, so the Nodes page must not let it be selected`,
        ).toBeDisabled({ timeout: Timeouts.THIRTY_SECONDS });
      });
    }

    for (const { nodeId, nodeName, pmmAgentId } of clientNodes) {
      await pmmTest.step(`Verify the API refuses to remove "${nodeName}"`, async () => {
        const nodeRefusal = `Node '${nodeName}' is managed by this PMM deployment`;

        await expectRefused(await api.inventoryApi.requestNodeRemoval(nodeId, true), nodeRefusal);
        await expectRefused(await api.inventoryApi.requestNodeUnregistration(nodeId, true), nodeRefusal);
        await expectRefused(
          await api.inventoryApi.requestAgentRemoval(pmmAgentId, true),
          `pmm-agent runs on Node '${nodeName}', which is managed by this PMM deployment`,
        );
      });
    }
  },
);
