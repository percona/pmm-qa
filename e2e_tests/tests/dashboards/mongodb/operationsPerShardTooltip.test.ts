import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  "PMM-T2372 - Verify Operations Per Shard adds up reads and writes and opens the chosen shard's ReplSet Summary @nightly @pmm-psmdb-sharding-integration",
  async ({ api, dashboard, page, urlHelper }) => {
    const { replSetSummary, shardedClusterSummary } = dashboard.mongo;
    const panelName = 'Operations Per Shard';
    const shard = 'rs2';
    const replSetLink = shardedClusterSummary.replSetSummaryLinkName(shard);

    await page.goto(
      urlHelper.buildUrlWithParameters(shardedClusterSummary.url, {
        cluster: 'sharded',
        from: 'now-10m',
        set: shard,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    // Operations counts every opcounter but command: query+getmore (reads) and insert+update+delete (writes).
    await dashboard.verifyLegendCalcIsSum(panelName, ['Reads Per Shard', 'Writes Per Shard'], shard);
    await dashboard.pinGraphTooltip(panelName);
    await dashboard.verifyPinnedGraphTooltip([shard, /ops\/s/], [replSetLink]);
    await dashboard.openGraphTooltipLink(replSetLink, replSetSummary.replSetUrlPattern(shard));

    await pmmTest.step(`Verify ${replSetSummary.name} shows only the ${shard} services`, async () => {
      const services = await api.inventoryApi.getAllServicesByReplicationSet('sharded', shard);

      await expect(dashboard.builders.dashboardTitle(replSetSummary.name)).not.toHaveCount(0, {
        timeout: Timeouts.ONE_MINUTE,
      });
      await expect(dashboard.builders.selectedVariableValues('Replica Set')).toHaveText([shard]);
      await dashboard.verifyRowTitles(
        replSetSummary.serviceRowPattern,
        services.map((service) => replSetSummary.serviceRowName(service.service_name)),
      );
    });
  },
);
