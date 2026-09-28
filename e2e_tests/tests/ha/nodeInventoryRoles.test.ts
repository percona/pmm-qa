import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2140 Verify leader/follower labels are shown for PMM HA nodes on the Inventory Nodes page @pmm-ha',
  async ({ haClusterHelper, nodesPage, page }) => {
    // Not /v1/ha/nodes: that is what the Nodes page renders, so it would only
    // prove the page echoes itself.
    const { leader, podNames } = await pmmTest.step('Read the leader from the cluster', async () => {
      const pods = haClusterHelper.podNames();

      expect(pods.length, 'HA runs more than one PMM Server pod').toBeGreaterThan(1);

      const podLeader = haClusterHelper.leaderFromPods(pods);

      expect(pods, 'The leader must be one of the PMM Server pods').toContain(podLeader);

      return { leader: podLeader, podNames: pods };
    });

    await page.goto(nodesPage.url);

    for (const podName of podNames) {
      const expectedLabel = podName === leader ? 'Leader' : 'Follower';

      await pmmTest.step(`Verify "${podName}" is labelled ${expectedLabel}`, async () => {
        await expect(
          nodesPage.builders.nodeRoleLabel(podName),
          `The cluster shows "${leader}" leading, so the Nodes page must label "${podName}" ${expectedLabel}`,
        ).toHaveText(expectedLabel, { timeout: Timeouts.THIRTY_SECONDS });
      });
    }
  },
);
