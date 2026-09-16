import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { haHealthOverviewPanels } from '@pages/dashboards/ha/haHealthOverview';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2289 - Verify HA health overview dashboard @pmm-ha',
  async ({ api, dashboard, haClusterHelper, highAvailabilityPage, k8sHelper, page }) => {
    const haDashboard = dashboard.haHealthOverview;
    const podNames = haClusterHelper.podNames();

    await pmmTest.step('Open the dashboard from the "PMM HA" navigation item', async () => {
      await page.goto(highAvailabilityPage.url);
      await highAvailabilityPage.openOverviewDashboard();
      await expect(page).toHaveURL(new RegExp(haDashboard.url), { timeout: Timeouts.ONE_MINUTE });
    });

    await pmmTest.step('Verify every panel of the dashboard renders', async () => {
      await dashboard.verifyMetricsPresent(haDashboard.metrics);
      await dashboard.verifyAllPanelsHaveData(haDashboard.noDataMetrics);
    });

    await pmmTest.step('Verify the Namespace variable offers only the namespace PMM HA runs in', async () => {
      expect(await haDashboard.getVariableValues('Namespace')).toEqual([k8sHelper.namespace]);
    });

    const initialLeader = await pmmTest.step('Verify the dashboard names the pod that leads', async () => {
      // The pods themselves, not /v1/ha/nodes: the dashboard and that API both
      // render the same Raft state, so it cannot judge the dashboard.
      const leader = haClusterHelper.leaderFromPods(podNames);

      await haDashboard.verifyLeaderPmmInstance(leader);
      await haDashboard.verifyPodRoles(leader, podNames);

      return leader;
    });

    await pmmTest.step(
      `Verify "${haHealthOverviewPanels.postgresqlPrimary}" names a PostgreSQL pod`,
      async () => {
        expect(await haDashboard.panelText(haHealthOverviewPanels.postgresqlPrimary)).toContain('pg-db');
      },
    );

    const promotionBeforeFailover = new Map<string, number>();

    await pmmTest.step('Baseline the promotion each pod last logged', async () => {
      for (const podName of podNames) {
        promotionBeforeFailover.set(podName, haClusterHelper.lastPromotionTime(podName));
      }
    });

    const newLeader = await pmmTest.step(`Restart the leader pod "${initialLeader}"`, async () => {
      const leader = await haClusterHelper.failoverLeader(api.haApi);

      expect(leader, 'Leadership must move off the restarted pod').not.toEqual(initialLeader);

      const baseline = promotionBeforeFailover.get(leader);

      // Never default to 0 here - that passes on a promotion from an earlier election.
      if (baseline === undefined) {
        throw new Error(
          `"${leader}" is not among the baselined pods: ${[...promotionBeforeFailover.keys()].join(', ')}`,
        );
      }

      // A pod killed while leading never logs a demotion, so only a *newer*
      // promotion on the pod that took over proves this election happened.
      expect(
        haClusterHelper.lastPromotionTime(leader),
        `"${leader}" must log a promotion newer than the one it had before the failover`,
      ).toBeGreaterThan(baseline);

      return leader;
    });

    await pmmTest.step('Verify the dashboard follows the failover', async () => {
      await haDashboard.verifyLeaderPmmInstance(newLeader);
    });

    await pmmTest.step(`Verify "${initialLeader}" rejoins as a Follower`, async () => {
      await haClusterHelper.waitForReadyPods(podNames.length);
      await haDashboard.verifyPodRoles(newLeader, podNames);
    });

    await pmmTest.step('Verify the restart is reflected in the health panels', async () => {
      await expect(async () => {
        await page.reload();

        expect(
          await haDashboard.tableRows(haHealthOverviewPanels.podsWithRestarts),
          `"${haHealthOverviewPanels.podsWithRestarts}" must list the restarted pod`,
        ).toContainEqual(expect.stringContaining(initialLeader));

        expect(
          await haDashboard.overallSystemHealth(),
          'A pod restarted inside the dashboard time range must take the cluster below 100% healthy',
        ).toBeLessThan(100);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });
  },
);
