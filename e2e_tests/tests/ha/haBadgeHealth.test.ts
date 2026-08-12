import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { pmmServerPodSelector } from '@helpers/haCluster.helper';

// The badge grades `expected_nodes` (a static 3, from PMM_HA_NODES) against the
// nodes reporting alive, so scaling the StatefulSet down walks it through every
// health level. Two thirds down is Critical, one third is Degraded.
const healthByReplicas = [
  { expectedHealth: 'Degraded', replicas: 2 },
  { expectedHealth: 'Critical', replicas: 1 },
  { expectedHealth: 'Unreachable', replicas: 0 },
];
const expectedNodes = 3;
// Set by the test, restored by the afterEach hook so the cluster is put back
// even when an assertion fails with the cluster scaled down.
let statefulSet: string | undefined;

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ k8sHelper }) => {
  if (!statefulSet) return;

  k8sHelper.scaleStatefulSet(statefulSet, expectedNodes).assertSuccess();

  // Polled rather than `kubectl wait`, which fails outright while the pods the
  // StatefulSet is bringing back one by one do not exist yet.
  await expect
    .poll(() => k8sHelper.getPods(pmmServerPodSelector).filter((pod) => pod.ready).length, {
      message: `The HA cluster must be left with ${expectedNodes} ready pods`,
      timeout: Timeouts.TEN_MINUTES,
    })
    .toEqual(expectedNodes);
});

pmmTest(
  'PMM-T2250 Verify the HA badge reflects the health of the PMM HA cluster @pmm-ha',
  async ({ api, haClusterHelper, highAvailabilityPage, k8sHelper, page }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    // The cluster is scaled with kubectl, so UI-only runs have nothing to test.
    // eslint-disable-next-line playwright/no-skipped-test -- conditional on cluster access, never a permanent skip
    pmmTest.skip(
      !k8sHelper.isAvailable(),
      `Namespace "${k8sHelper.namespace}" is not reachable with the current kubeconfig`,
    );

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

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

    await page.goto(highAvailabilityPage.url);

    await pmmTest.step('Verify the HA badge is Healthy', async () => {
      await expect(
        highAvailabilityPage.elements.badge,
        `All ${expectedNodes} nodes are alive, so the HA badge must be Healthy`,
      ).toHaveText('Healthy', { timeout: Timeouts.TWO_MINUTES });
    });

    for (const { expectedHealth, replicas } of healthByReplicas) {
      await pmmTest.step(`Scale the cluster to ${replicas} replicas`, async () => {
        k8sHelper.scaleStatefulSet(statefulSet as string, replicas).assertSuccess();
      });

      // Deliberately no reload: at 0 replicas nothing serves the page, so the
      // badge has to be read from the app already in the browser. Its own 15s
      // refetch drives every transition, including the one into Unreachable,
      // which the UI derives from the failing query rather than from a payload.
      await pmmTest.step(`Verify the HA badge is ${expectedHealth}`, async () => {
        await expect(
          highAvailabilityPage.elements.badge,
          `${expectedNodes - replicas} of ${expectedNodes} nodes are down, so the HA badge must be ${expectedHealth}`,
        ).toHaveText(expectedHealth, { timeout: Timeouts.FIVE_MINUTES });
      });
    }
  },
);
