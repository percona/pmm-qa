import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import HaApi from '@api/ha.api';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2233 Verify "pmm_ha_leader_status" metric correctly reflects the current leader status @pmm-ha',
  async ({ api, haClusterHelper, highAvailabilityPage, k8sHelper, page }) => {
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
        const clusterNodes = await api.haApi.getNodeNames();

        // Polled: a node that joined recently only shows up after the next scrape.
        await expect
          .poll(async () => await api.haApi.getNodesFromMetrics(), {
            message: `Every HA node must export ${HaApi.leaderStatusMetric}`,
            timeout: Timeouts.TWO_MINUTES,
          })
          .toEqual(clusterNodes);

        expect(
          await api.haApi.waitForLeaderInMetrics(undefined, Timeouts.TWO_MINUTES),
          'The leader in metrics must be the one the HA badge names',
        ).toEqual(initialLeader);
      },
    );

    await pmmTest.step(`Verify sum(${HaApi.leaderStatusMetric}) equals 1`, async () => {
      await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
    });

    const promotionsBeforeFailover = new Map<string, number>();

    await pmmTest.step('Baseline the promotion each node last logged', async () => {
      for (const node of await api.haApi.getNodeNames()) {
        promotionsBeforeFailover.set(node, haClusterHelper.lastPromotionTime(node));
      }
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

    await pmmTest.step(`Confirm "${newLeader}" logged a fresh promotion in its pod`, async () => {
      const baseline = promotionsBeforeFailover.get(newLeader);

      // Never default to 0 here - that passes on a promotion from an earlier election.
      if (baseline === undefined) {
        throw new Error(
          `"${newLeader}" is not among the baselined HA nodes: ${[...promotionsBeforeFailover.keys()].join(', ')}`,
        );
      }

      // It has to be a *new* promotion: a node killed while leading never logs a
      // demotion, so the presence of the line alone proves nothing.
      await expect
        .poll(() => haClusterHelper.lastPromotionTime(newLeader), {
          message: `"${newLeader}" must log a promotion newer than the one it had before the failover`,
          timeout: Timeouts.TWO_MINUTES,
        })
        .toBeGreaterThan(baseline);
    });

    await pmmTest.step(`Verify the HA badge shows "${newLeader}" as the new leader`, async () => {
      await highAvailabilityPage.reloadAndExpandHaNavItem();
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

        await api.haApi.waitForLeaderStatusSum(1, Timeouts.TWO_MINUTES);
      },
    );
  },
);
