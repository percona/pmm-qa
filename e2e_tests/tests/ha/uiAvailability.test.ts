import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2138 - Verify PMM UI is accessible if leader pod goes down @pmm-ha',
  async ({ api, dashboard, haClusterHelper, page, request }) => {
    await pmmTest.step('Log in to the PMM UI on the public URL', async () => {
      await page.goto(dashboard.home.url);

      await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
        timeout: Timeouts.ONE_MINUTE,
      });
    });

    await pmmTest.step('Verify the leader the HA API reports is the pod that holds leadership', async () => {
      const nodes = await api.haApi.getNodes();
      const leaders = nodes.filter((node) => node.role === HaNodeRole.leader);

      expect(nodes).toHaveLength(defaultReplicas);
      expect(nodes.map((node) => node.status)).toEqual(Array(defaultReplicas).fill('alive'));
      expect(leaders.map((node) => node.node_name)).toEqual([haClusterHelper.leaderFromPods()]);
    });

    const { failures, longestOutage, newLeader, probes } = await pmmTest.step(
      'Restart the leader pod while polling the public URL',
      async () => await haClusterHelper.failoverLeaderWhileProbing(api.haApi, request, dashboard.home.url),
    );

    await pmmTest.step(
      `Verify the UI stayed available while "${newLeader}" took over, across ${probes} requests`,
      async () => {
        // The case is "the UI should always be up", so the budget is zero: every
        // request through HAProxy is served, or this is a real outage.
        expect(
          failures,
          `The public URL must serve every request through the failover, but ${failures} of ${probes} ` +
            `failed - the longest unbroken outage was ${longestOutage / Timeouts.ONE_SECOND}s`,
        ).toEqual(0);

        await page.goto(dashboard.home.url);

        await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
          timeout: Timeouts.ONE_MINUTE,
        });
      },
    );
  },
);
