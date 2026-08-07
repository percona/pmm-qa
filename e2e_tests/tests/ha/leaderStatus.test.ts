import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaApi from '@api/ha.api';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2233 Verify "pmm_ha_leader_status" metric correctly reflects the current leader status @pmm-ha',
  async ({ api, highAvailabilityPage, k8sHelper, page }) => {
    // A Raft election plus the scrape that publishes it, then the restarted pod
    // rejoining, add up to more than the default per-test budget.
    pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

    // The failover is driven with kubectl, so the run needs cluster access.
    // ha-e2e-tests.yml can be dispatched without a kubeconfig artifact URL for
    // UI-only runs - skip rather than fail there.
    // eslint-disable-next-line playwright/no-skipped-test -- conditional on cluster access, never a permanent skip
    pmmTest.skip(
      !k8sHelper.isAvailable(),
      `Namespace "${k8sHelper.namespace}" is not reachable with the current kubeconfig`,
    );

    await pmmTest.step('Verify HA mode is enabled', async () => {
      expect(await api.haApi.getStatus()).toEqual('Enabled');
    });

    await page.goto(highAvailabilityPage.url);

    const initialLeader = await pmmTest.step('Read the current leader from the HA badge', async () => {
      await expect(highAvailabilityPage.elements.badge).toBeVisible();

      const leader = await highAvailabilityPage.getLeaderName();

      expect(leader, 'HA badge must name a leader').not.toEqual('Unknown');

      return leader;
    });

    await pmmTest.step(
      `Verify "${HaApi.leaderStatusMetric}" reports "${initialLeader}" as leader`,
      async () => {
        const nodesInMetrics = await api.haApi.getNodesFromMetrics();
        const clusterNodes = (await api.haApi.getNodes()).map((node) => node.nodeName);

        expect(nodesInMetrics, 'Every HA node must export the leader status metric').toEqual(
          expect.arrayContaining(clusterNodes),
        );
        expect(await api.haApi.waitForLeaderInMetrics()).toEqual(initialLeader);
      },
    );

    await pmmTest.step(`Verify sum(${HaApi.leaderStatusMetric}) equals 1`, async () => {
      await expect
        .poll(async () => await api.haApi.getLeaderStatusSum(), {
          message: 'Exactly one node must hold the Raft leader lease',
          timeout: Timeouts.TWO_MINUTES,
        })
        .toEqual(1);
    });

    await pmmTest.step(`Restart the leader pod "${initialLeader}"`, async () => {
      const podNames = k8sHelper.getPodNames();

      expect(
        podNames,
        `HA leader "${initialLeader}" has no matching pod in namespace "${k8sHelper.namespace}"`,
      ).toContain(initialLeader);

      k8sHelper.deletePod(initialLeader).assertSuccess();
    });

    const newLeader = await pmmTest.step(
      'Verify a new leader is elected and exported in metrics',
      async () => {
        const leader = await api.haApi.waitForLeaderInMetrics(initialLeader, Timeouts.FIVE_MINUTES);

        expect(leader, 'Leadership must move off the restarted node').not.toEqual(initialLeader);

        return leader;
      },
    );

    await pmmTest.step(`Verify the HA badge shows "${newLeader}" as the new leader`, async () => {
      await highAvailabilityPage.expandHaNavItem();
      // The sidebar refetches /v1/ha/nodes every 15s, so no reload is needed.
      await expect(highAvailabilityPage.leaderNameLocator()).toHaveText(newLeader, {
        timeout: Timeouts.TWO_MINUTES,
      });
    });

    await pmmTest.step(
      'Verify the cluster settles with exactly one leader once the pod is back',
      async () => {
        // Polled rather than `kubectl wait`, because the StatefulSet may not
        // have recreated the pod yet and `wait` fails outright on a missing one.
        await expect
          .poll(() => k8sHelper.getPods().find((pod) => pod.name === initialLeader)?.ready === true, {
            message: `Pod "${initialLeader}" must rejoin the cluster as a follower`,
            timeout: Timeouts.FIVE_MINUTES,
          })
          .toBeTruthy();

        await expect
          .poll(async () => await api.haApi.getLeaderStatusSum(), {
            message: `sum(${HaApi.leaderStatusMetric}) must stay 1 - 0 means no leader, >1 means split-brain`,
            timeout: Timeouts.TWO_MINUTES,
          })
          .toEqual(1);
      },
    );
  },
);
