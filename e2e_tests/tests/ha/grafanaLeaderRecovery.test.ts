import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { defaultReplicas, pmmServerPodSelector } from '@helpers/haCluster.helper';
import { Timeouts } from '@helpers/timeouts';

const loginPath = 'graph/login';
// The chart's liveness budget is 6 failures 10s apart, plus the container's shutdown.
const recoveryBudget = Timeouts.ONE_MINUTE + Timeouts.THIRTY_SECONDS;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

// Without the liveness probe nothing restarts Grafana, and every later test would see 502.
pmmTest.afterEach(async ({ haClusterHelper, k8sHelper }) => {
  for (const podName of haClusterHelper.podNames()) {
    k8sHelper.execInPod(podName, 'supervisorctl start grafana', { silent: true });
  }
});

pmmTest(
  'PMM-T2396 - Verify PMM UI comes back on its own after Grafana stops on the HA leader @pmm-ha',
  async ({ haClusterHelper, highAvailabilityPage, k8sHelper, leftNavigation, page }) => {
    pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

    const loginStatus = async (): Promise<number> => (await page.request.get(loginPath)).status();
    const restarts = (): Map<string, number> =>
      new Map(k8sHelper.getPods(pmmServerPodSelector).map((pod) => [pod.name, pod.restarts]));

    await leftNavigation.verifyUiRenders(highAvailabilityPage.url);

    const [leader, restartsBefore] = await pmmTest.step(
      'Read the current leader and every replica restart count',
      async () => [haClusterHelper.leaderFromPods(), restarts()] as const,
    );

    await pmmTest.step('Verify the login page answers 200 through HAProxy', async () => {
      expect(await loginStatus()).toEqual(200);
    });

    const stoppedAt = await pmmTest.step(`Stop Grafana on the leader "${leader}"`, async () => {
      k8sHelper.execInPod(leader, 'supervisorctl stop grafana').assertSuccess();

      return Date.now();
    });

    await pmmTest.step('Verify HAProxy keeps routing to the leader and the UI answers 502', async () => {
      await expect(async () => {
        expect(await loginStatus()).toEqual(502);
      }).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step(
      `Verify the UI answers 200 again within ${recoveryBudget / 1_000}s of the stop`,
      async () => {
        await expect(async () => {
          expect(await loginStatus()).toEqual(200);
        }).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: stoppedAt + recoveryBudget - Date.now() });
      },
    );

    await pmmTest.step('Verify leadership moved off the old leader', async () => {
      await haClusterHelper.waitForLeaderChange(leader, Timeouts.ONE_MINUTE);
    });

    await pmmTest.step(`Verify only "${leader}" was restarted, once`, async () => {
      const expected = new Map(restartsBefore);

      expected.set(leader, (restartsBefore.get(leader) ?? 0) + 1);

      await expect.poll(restarts, { timeout: Timeouts.ONE_MINUTE }).toEqual(expected);
    });

    await pmmTest.step(
      `Verify "${leader}" was restarted by the liveness probe for a replica fault`,
      async () => {
        await expect(() => {
          const messages = k8sHelper.getEventMessages(leader);

          expect(messages.some((message) => message.includes('replica fault, restarting'))).toBeTruthy();
          expect(
            messages.some((message) => message.includes('failed liveness probe, will be restarted')),
          ).toBeTruthy();
        }).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: Timeouts.THIRTY_SECONDS });
      },
    );

    await pmmTest.step('Verify every replica is ready again and the UI renders', async () => {
      await haClusterHelper.waitForReadyPods(defaultReplicas);
      await leftNavigation.verifyUiRenders(highAvailabilityPage.url);
    });
  },
);
