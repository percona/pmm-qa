import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';

const defaultReplicas = 3;
const scaledReplicas = 5;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi, defaultReplicas);
});

pmmTest.afterEach(async ({ api, haClusterHelper }) => {
  await haClusterHelper.ensureLeaderAmong(haClusterHelper.podNames().slice(0, defaultReplicas));
  await haClusterHelper.ensureServing(api.haApi, defaultReplicas);
});

pmmTest(
  `PMM-T2124 Verify the PMM HA cluster can be scaled to ${scaledReplicas} pods @pmm-ha`,
  async ({ api, haClusterHelper, k8sHelper, nodesPage, page }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    const statefulSet = haClusterHelper.statefulSetName();

    await pmmTest.step(`Scale the cluster to ${scaledReplicas} replicas`, async () => {
      expect(
        k8sHelper.getStatefulSetReplicas(statefulSet),
        `The cluster must start from its ${defaultReplicas} chart replicas`,
      ).toEqual(defaultReplicas);

      k8sHelper.scaleStatefulSet(statefulSet, scaledReplicas).assertSuccess();
      await haClusterHelper.waitForReadyPods(scaledReplicas, Timeouts.TEN_MINUTES);
    });

    const podNames = haClusterHelper.podNames();

    expect(podNames, `The StatefulSet must run ${scaledReplicas} PMM Server pods`).toHaveLength(
      scaledReplicas,
    );

    await pmmTest.step('Verify the new pods joined the HA cluster', async () => {
      // The joining pods are added to the memberlist by gossip and to Raft by
      // the leader, so both trail the pods being Ready.
      await expect(async () => {
        const nodes = await api.haApi.getNodes();

        expect(
          nodes.map((node) => node.node_name).sort(),
          `All ${scaledReplicas} pods must be listed as HA nodes`,
        ).toEqual(podNames);

        expect(
          nodes.map((node) => node.status),
          'Every HA node must be alive',
        ).toEqual(Array(scaledReplicas).fill('alive'));

        expect(
          nodes.filter((node) => node.role === HaNodeRole.leader),
          'The scaled-up cluster must still have exactly one leader',
        ).toHaveLength(1);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

      await api.haApi.waitForLeaderStatusSum(1);
    });

    await pmmTest.step(`Verify the Inventory Nodes page lists all ${scaledReplicas} nodes`, async () => {
      await page.goto(nodesPage.url, { timeout: Timeouts.TWO_MINUTES });

      for (const podName of podNames) {
        await expect(
          nodesPage.builders.nodeStatusCell(podName),
          `HA node "${podName}" is running, so the Nodes page must show it Up`,
        ).toHaveText('Up', { timeout: Timeouts.TWO_MINUTES });
      }
    });
  },
);
