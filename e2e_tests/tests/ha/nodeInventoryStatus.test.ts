import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2145 Verify the node status of PMM HA nodes on the Inventory Nodes page @pmm-ha',
  async ({ api, haClusterHelper, k8sHelper, nodesPage, page }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    // The restart is driven with kubectl, so UI-only runs have nothing to test.
    // eslint-disable-next-line playwright/no-skipped-test -- conditional on cluster access, never a permanent skip
    pmmTest.skip(
      !k8sHelper.isAvailable(),
      `Namespace "${k8sHelper.namespace}" is not reachable with the current kubeconfig`,
    );

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    // The leader comes from the pods, not /v1/ha/nodes: that is what the Nodes
    // page renders from, so it would only prove the page echoes itself.
    const { initialLeader, podNames } = await pmmTest.step('Read the leader from the cluster', async () => {
      const pods = haClusterHelper.podNames();

      expect(pods.length, 'HA runs more than one PMM Server pod').toBeGreaterThan(1);

      const podLeader = haClusterHelper.leaderFromPods(pods);

      expect(pods, 'The leader must be one of the PMM Server pods').toContain(podLeader);

      return { initialLeader: podLeader, podNames: pods };
    });

    const verifyNodesTable = async (expectedLeader: string): Promise<void> => {
      for (const podName of podNames) {
        const expectedRole = podName === expectedLeader ? 'Leader' : 'Follower';

        await pmmTest.step(`Verify "${podName}" is Up and labelled ${expectedRole}`, async () => {
          await expect(
            nodesPage.builders.nodeStatusCell(podName),
            `HA node "${podName}" is running, so the Nodes page must show it Up`,
          ).toHaveText('Up', { timeout: Timeouts.TWO_MINUTES });

          await expect(
            nodesPage.builders.nodeRoleLabel(podName),
            `The cluster shows "${expectedLeader}" leading, so "${podName}" must be labelled ${expectedRole}`,
          ).toHaveText(expectedRole, { timeout: Timeouts.THIRTY_SECONDS });
        });
      }
    };

    await page.goto(nodesPage.url);

    await pmmTest.step('Verify every HA node is Up with exactly one leader', async () => {
      await verifyNodesTable(initialLeader);
    });

    await pmmTest.step(`Restart the leader pod "${initialLeader}"`, async () => {
      expect(
        k8sHelper.getPodNames(),
        `HA leader "${initialLeader}" has no matching pod in namespace "${k8sHelper.namespace}"`,
      ).toContain(initialLeader);

      k8sHelper.deletePod(initialLeader).assertSuccess();
    });

    const newLeader = await pmmTest.step(
      'Verify a new leader is elected',
      async () => await haClusterHelper.waitForLeaderChange(initialLeader, Timeouts.FIVE_MINUTES),
    );

    await pmmTest.step(`Wait for "${initialLeader}" to rejoin the cluster`, async () => {
      // Polled rather than `kubectl wait`, because the StatefulSet may not have
      // recreated the pod yet and `wait` fails outright on a missing one.
      await expect
        .poll(() => k8sHelper.getPods().find((pod) => pod.name === initialLeader)?.ready === true, {
          message: `Pod "${initialLeader}" must come back as a follower`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toBeTruthy();
    });

    await pmmTest.step(`Verify the Nodes page shows "${newLeader}" leading and every node Up`, async () => {
      // The page was served by the pod that was restarted, so its queries can be
      // left holding a failed request instead of retrying.
      await page.reload({ timeout: Timeouts.TWO_MINUTES });
      await verifyNodesTable(newLeader);
    });
  },
);
