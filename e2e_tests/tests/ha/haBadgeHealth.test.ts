import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { pmmServerPodSelector } from '@helpers/haCluster.helper';

// The badge grades `expected_nodes` - static, from PMM_HA_NODES - against the
// nodes reporting alive, so scaling down walks it through every health level.
const healthByReplicas = [
  { expectedHealth: 'Degraded', replicas: 2 },
  { expectedHealth: 'Critical', replicas: 1 },
  { expectedHealth: 'Unreachable', replicas: 0 },
];
const expectedNodes = 3;
let statefulSet: string | undefined;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi, expectedNodes);
});

pmmTest.afterEach(async ({ api, haClusterHelper }) => {
  await haClusterHelper.ensureServing(api.haApi, expectedNodes);
});

pmmTest(
  'PMM-T2250 Verify the HA badge reflects the health of the PMM HA cluster @pmm-ha',
  async ({ api, haClusterHelper, highAvailabilityPage, k8sHelper, page }) => {
    await pmmTest.step(`Verify the cluster starts with ${expectedNodes} pods up and running`, async () => {
      statefulSet = haClusterHelper.statefulSetName();

      expect(
        k8sHelper.getStatefulSetReplicas(statefulSet),
        `The Degraded and Critical thresholds below are derived from a ${expectedNodes}-node cluster`,
      ).toEqual(expectedNodes);

      const pods = k8sHelper.getPods(pmmServerPodSelector);

      expect(
        pods.map((pod) => pod.ready),
        `Every PMM Server pod must be ready before scaling down`,
      ).toEqual(Array(expectedNodes).fill(true));
    });

    // Scaling down removes the highest ordinals. Only the leader removes departing
    // members from the Raft config, so if the leader is one of them the survivor is
    // left alone in a 3-node config, never regains quorum and 503s indefinitely -
    // Critical is reachable only with the surviving pod already leading.
    await pmmTest.step('Move leadership onto the pod that survives the scale-down', async () => {
      const survivor = haClusterHelper.podNames()[0];

      for (let attempt = 0; haClusterHelper.leaderFromPods() !== survivor; attempt++) {
        // Each failover is a coin flip between the two followers, so allow plenty:
        // at four attempts this failed roughly one run in sixteen.
        expect(attempt, `Leadership never landed on "${survivor}"`).toBeLessThan(8);

        await haClusterHelper.failoverLeader(api.haApi);
        await expect
          .poll(() => k8sHelper.getPods(pmmServerPodSelector).filter((pod) => pod.ready).length, {
            message: `All ${expectedNodes} pods must rejoin before the next attempt`,
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toEqual(expectedNodes);
      }
    });

    await page.goto(highAvailabilityPage.url);

    await expect(
      highAvailabilityPage.elements.badge,
      `All ${expectedNodes} nodes are alive, so the HA badge must be Healthy`,
    ).toHaveText('Healthy', { timeout: Timeouts.TWO_MINUTES });

    for (const { expectedHealth, replicas } of healthByReplicas) {
      await pmmTest.step(`Scale the cluster to ${replicas} replicas`, async () => {
        k8sHelper.scaleStatefulSet(statefulSet as string, replicas).assertSuccess();
      });

      // Never reload: at 0 replicas nothing serves the page. The app's own 15s
      // refetch drives every transition, Unreachable included.
      await expect(
        highAvailabilityPage.elements.badge,
        `${expectedNodes - replicas} of ${expectedNodes} nodes are down, so the HA badge must be ${expectedHealth}`,
      ).toHaveText(expectedHealth, { timeout: Timeouts.FIVE_MINUTES });
    }
  },
);
