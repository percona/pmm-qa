import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { KubernetesPod } from '@interfaces/kubernetes';
import { Timeouts } from '@helpers/timeouts';
import { haproxyPodSelector, pmmServerPodSelector } from '@helpers/haCluster.helper';

const expectedNodes = 3;
const readyCount = (pods: KubernetesPod[]): number => pods.filter((pod) => pod.ready).length;

const readyTimes = (pods: KubernetesPod[]): number[] => {
  const times = pods.map((pod) => pod.readySince).filter((time): time is number => time !== undefined);

  expect(
    times,
    `Every pod must report when it became ready: ${pods.map((pod) => pod.name).join(', ')}`,
  ).toHaveLength(pods.length);

  return times;
};

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi, expectedNodes);
});

pmmTest.afterEach(async ({ api, haClusterHelper }) => {
  await haClusterHelper.ensureServing(api.haApi, expectedNodes);
});

pmmTest(
  'PMM-T2287 Verify haproxy pods start even without all pmm-ha pods running @pmm-ha',
  async ({ api, k8sHelper }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    const haproxyBefore = k8sHelper.getPods(haproxyPodSelector);
    const pmmBefore = k8sHelper.getPods(pmmServerPodSelector);

    await pmmTest.step('Verify no HAProxy pod gates its start on PMM Server readiness', async () => {
      expect(haproxyBefore, 'The chart must run HAProxy pods to route to the leader').not.toHaveLength(0);

      for (const pod of haproxyBefore) {
        expect(
          pod.initContainers,
          `"${pod.name}" must start on its own: an init container polling every PMM replica holds HAProxy at Init:0/1 until the whole StatefulSet is up`,
        ).toEqual([]);
      }
    });

    // A terminating pod still reports Ready, and the StatefulSet reuses its pod
    // names, so the replacements are told apart by UID rather than by name.
    const replacedUids = new Set([...haproxyBefore, ...pmmBefore].map((pod) => pod.uid));
    const replacements = (selector: string): KubernetesPod[] =>
      k8sHelper.getPods(selector).filter((pod) => !replacedUids.has(pod.uid));

    await pmmTest.step('Restart every PMM Server and HAProxy pod at once', async () => {
      k8sHelper.deletePods([...haproxyBefore, ...pmmBefore].map((pod) => pod.name)).assertSuccess();
    });

    let pmmReady = expectedNodes;

    await pmmTest.step('Verify the HAProxy pods are ready while PMM Server pods still are not', async () => {
      await expect
        .poll(
          () => {
            const haproxyReady = readyCount(replacements(haproxyPodSelector));

            // Sampled after HAProxy, so the gap between the two reads can only
            // ever make the assertion below harder to satisfy.
            pmmReady = readyCount(replacements(pmmServerPodSelector));

            return haproxyReady;
          },
          {
            message: `All ${haproxyBefore.length} restarted HAProxy pods must become ready`,
            timeout: Timeouts.FIVE_MINUTES,
          },
        )
        .toEqual(haproxyBefore.length);

      expect(pmmReady, `HAProxy must not wait for all ${expectedNodes} PMM Server pods`).toBeLessThan(
        expectedNodes,
      );
    });

    await pmmTest.step('Verify every HAProxy pod was ready before the first PMM Server pod', async () => {
      await expect
        .poll(() => readyCount(replacements(pmmServerPodSelector)), {
          message: `All ${expectedNodes} restarted PMM Server pods must rejoin`,
          timeout: Timeouts.TEN_MINUTES,
        })
        .toEqual(expectedNodes);

      const lastHaproxyReady = Math.max(...readyTimes(replacements(haproxyPodSelector)));
      const firstPmmReady = Math.min(...readyTimes(replacements(pmmServerPodSelector)));

      expect(
        lastHaproxyReady,
        `The last HAProxy pod was ready at ${new Date(lastHaproxyReady).toISOString()}, which must precede the first PMM Server pod at ${new Date(firstPmmReady).toISOString()}`,
      ).toBeLessThan(firstPmmReady);
    });
  },
);
