import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'Verify Operations Per Shard graph tooltip on MongoDB Sharded Cluster Summary @nightly',
  async ({ dashboard, page, urlHelper }) => {
    const panelName = 'Operations Per Shard';
    const shard = 'rs2';

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
        cluster: 'sharded',
        from: 'now-15m',
        set: shard,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await dashboard.pinGraphTooltip(panelName);

    await pmmTest.step('Verify the pinned tooltip', async () => {
      const tooltip = dashboard.elements.graphTooltip;

      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(shard);
      await expect(tooltip).toContainText(/ops\/s/);
      await expect(tooltip.getByRole('link', { name: `MongoDB ReplSet Summary - ${shard}` })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Add annotation' })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Close' })).toBeVisible();
    });
  },
);
