import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  "PMM-T2372 - Verify Operations Per Shard adds up reads and writes and opens the chosen shard's ReplSet Summary @nightly @pmm-psmdb-integration",
  async ({ api, dashboard, page, urlHelper }) => {
    const panelName = 'Operations Per Shard';
    const shard = 'rs2';
    const replSetLink = `MongoDB ReplSet Summary - ${shard}`;

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
        cluster: 'sharded',
        from: 'now-15m',
        set: shard,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();

    await pmmTest.step(
      `Verify the ${panelName} mean is about Reads Per Shard plus Writes Per Shard`,
      async () => {
        // Operations counts every opcounter but command: query+getmore (reads) and insert+update+delete (writes).
        const operations = await dashboard.getLegendCalc(panelName, shard);
        const reads = await dashboard.getLegendCalc('Reads Per Shard', shard);
        const writes = await dashboard.getLegendCalc('Writes Per Shard', shard);

        expect(operations).toBeGreaterThan(0);
        expect(
          Math.abs(operations - (reads + writes)),
          `${panelName} mean ${operations} vs Reads ${reads} + Writes ${writes}`,
        ).toBeLessThanOrEqual(operations * 0.05);
      },
    );

    await dashboard.pinGraphTooltip(panelName);

    await pmmTest.step('Verify the pinned tooltip', async () => {
      const tooltip = dashboard.elements.graphTooltip;

      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(shard);
      await expect(tooltip).toContainText(/ops\/s/);
      await expect(tooltip.getByRole('link', { name: replSetLink })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Add annotation' })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Close' })).toBeVisible();
    });

    // The data link opens a new tab; the dashboard fixture drives `page`, so reopen its URL there.
    const replSetUrl = await pmmTest.step(`Open ${replSetLink} from the tooltip`, async () => {
      const popupPromise = page.waitForEvent('popup');

      await dashboard.elements.graphTooltip.getByRole('link', { name: replSetLink }).click();

      const popup = await popupPromise;

      await expect(popup).toHaveURL(
        new RegExp(`${dashboard.mongo.replSetSummary.url}\\?.*var-rs_nm=${shard}`),
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );

      const url = popup.url();

      await popup.close();

      return url;
    });

    await page.goto(replSetUrl);

    await pmmTest.step(`Verify MongoDB ReplSet Summary shows only the ${shard} services`, async () => {
      const shardServiceRows = (await api.inventoryApi.getServices()).services
        .filter((service) => service.cluster === 'sharded' && service.replication_set === shard)
        .map((service) => `Overview - ${service.service_name}`)
        .sort();

      expect(shardServiceRows).not.toHaveLength(0);
      await expect(dashboard.builders.dashboardTitle('MongoDB ReplSet Summary')).not.toHaveCount(0, {
        timeout: Timeouts.ONE_MINUTE,
      });
      await expect(dashboard.builders.selectedVariableValues('Replica Set')).toHaveText([shard]);
      // Service rows mount one by one after the dashboard loads.
      await expect
        .poll(
          async () =>
            (await dashboard.elements.rowTitles.filter({ hasText: /^Overview - / }).allTextContents()).sort(),
          { timeout: Timeouts.THIRTY_SECONDS },
        )
        .toEqual(shardServiceRows);
    });
  },
);
