import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  "PMM-T2372 - Verify Operations Per Shard adds up reads and writes and opens the chosen shard's ReplSet Summary @pmm-psmdb-sharding-integration",
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

pmmTest(
  'PMM-T2501 - Verify the per-shard panels show one line per shard without the config servers, pick out the hot shard and follow the Shard / Replica Set filter @pmm-psmdb-sharding-integration',
  async ({ dashboard, page, urlHelper }) => {
    const { shardedClusterSummary } = dashboard.mongo;
    const { perShardMetrics, shardFilter } = shardedClusterSummary;
    const panelNames = perShardMetrics.map((panel) => panel.name);

    await page.goto(
      urlHelper.buildUrlWithParameters(shardedClusterSummary.url, {
        cluster: 'sharded',
        environment: 'mongo-sharded-dev',
        from: 'now-10m',
        set: 'All',
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect(dashboard.builders.selectedVariableValues(shardFilter)).toHaveText(['All']);
    await dashboard.verifyPanelValues(perShardMetrics);

    for (const panelName of panelNames) {
      await dashboard.verifyLegendSeries(panelName, ['rs1', 'rs2']);
    }

    // HOT_SHARD=rs1 runs a write-only load through mongos that only rs1 takes.
    await pmmTest.step(
      'Verify rs1 is the hot shard for writes and its write load adds no reads',
      async () => {
        const rs1Writes = await dashboard.getLegendCalc('Writes Per Shard', 'rs1');
        const rs2Writes = await dashboard.getLegendCalc('Writes Per Shard', 'rs2');
        const rs1Reads = await dashboard.getLegendCalc('Reads Per Shard', 'rs1');

        expect
          .soft(rs1Writes, `Writes Per Shard Mean: rs1 ${rs1Writes}, rs2 ${rs2Writes}`)
          .toBeGreaterThanOrEqual(3 * rs2Writes);
        expect
          .soft(rs1Reads, `rs1 Mean: Reads Per Shard ${rs1Reads}, Writes Per Shard ${rs1Writes}`)
          .toBeLessThan(rs1Writes / 3);
        expect
          .soft(
            await dashboard.getLegendCalc('Operations Per Shard', 'rs1'),
            'Operations Per Shard Mean of rs1 vs rs2',
          )
          .toBeGreaterThan(await dashboard.getLegendCalc('Operations Per Shard', 'rs2'));
      },
    );

    for (const shard of ['rs1', 'rs2']) {
      await pmmTest.step(
        `Verify ${shardFilter} ${shard} limits every per-shard panel to ${shard}`,
        async () => {
          await dashboard.unselectVariableValue(shardFilter);
          await dashboard.selectVariableValue(shardFilter, shard);
          await expect(dashboard.builders.selectedVariableValues(shardFilter)).toHaveText([shard]);

          for (const panelName of panelNames) {
            await dashboard.verifyLegendSeries(panelName, [shard]);
          }
        },
      );
    }
  },
);

for (const panelName of [
  'Reads Per Shard',
  'Writes Per Shard',
  'Documents Scanned Per Shard',
  'Query Targeting Per Shard',
] as const) {
  pmmTest(
    `PMM-T2502 - Verify each new per-shard panel opens the clicked shard's ReplSet Summary with the cluster, environment, interval and time range kept @pmm-psmdb-sharding-integration | ${panelName}`,
    async ({ api, dashboard, page, urlHelper }) => {
      const { replSetSummary, shardedClusterSummary } = dashboard.mongo;
      const shard = 'rs2';
      const replSetLink = shardedClusterSummary.replSetSummaryLinkName(shard);

      await page.goto(
        urlHelper.buildUrlWithParameters(shardedClusterSummary.url, {
          cluster: 'sharded',
          environment: 'mongo-sharded-dev',
          from: 'now-30m',
          interval: '5m',
          set: shard,
          to: 'now',
        }),
      );
      await dashboard.loadAllPanels();
      await dashboard.pinGraphTooltip(panelName);
      await dashboard.verifyPinnedGraphTooltip([shard], [replSetLink]);
      await dashboard.openGraphTooltipLink(replSetLink, replSetSummary.replSetUrlPattern(shard));

      await pmmTest.step(
        `Verify ${replSetSummary.name} keeps the shard, filters and time range`,
        async () => {
          const services = await api.inventoryApi.getAllServicesByReplicationSet('sharded', shard);

          await expect(dashboard.builders.selectedVariableValues('Replica Set')).toHaveText([shard]);
          await expect(dashboard.builders.selectedVariableValues('Cluster')).toHaveText(['sharded']);
          await expect(dashboard.builders.selectedVariableValues('Environment')).toHaveText([
            'mongo-sharded-dev',
          ]);
          await expect(dashboard.builders.selectedVariableValues('Interval')).toHaveText(['5m']);
          await expect(dashboard.elements.timePickerOpenButton).toContainText('Last 30 minutes');
          await dashboard.verifyRowTitles(
            replSetSummary.serviceRowPattern,
            services.map((service) => replSetSummary.serviceRowName(service.service_name)),
          );
        },
      );
    },
  );
}

pmmTest(
  'PMM-T2503 - Verify Documents Scanned and Query Targeting Per Shard pick out the shard whose queries scan many documents per document returned @pmm-psmdb-sharding-integration',
  async ({ dashboard, page, urlHelper }) => {
    const { shardedClusterSummary } = dashboard.mongo;

    await page.goto(
      urlHelper.buildUrlWithParameters(shardedClusterSummary.url, {
        cluster: 'sharded',
        from: 'now-10m',
        set: 'All',
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await dashboard.verifyLegendSeries('Documents Scanned Per Shard', ['rs1', 'rs2']);
    await dashboard.verifyLegendSeries('Query Targeting Per Shard', ['rs1', 'rs2']);

    // SCAN_SHARD=rs2 queries an unindexed field of 20,000 documents on rs2, returning one per query.
    await pmmTest.step('Verify rs2 scans the most and has the worst query targeting', async () => {
      const rs1Scanned = await dashboard.getLegendCalc('Documents Scanned Per Shard', 'rs1');
      const rs2Scanned = await dashboard.getLegendCalc('Documents Scanned Per Shard', 'rs2');

      expect
        .soft(rs2Scanned, `Documents Scanned Per Shard Mean: rs2 ${rs2Scanned}, rs1 ${rs1Scanned}`)
        .toBeGreaterThanOrEqual(10 * rs1Scanned);
      expect
        .soft(
          await dashboard.getLegendCalc('Query Targeting Per Shard', 'rs2'),
          'Query Targeting Per Shard Mean of rs2',
        )
        .toBeGreaterThan(1_000);
      expect
        .soft(
          await dashboard.getLegendCalc('Query Targeting Per Shard', 'rs1'),
          'Query Targeting Per Shard Mean of rs1',
        )
        .toBeLessThan(100);
    });
  },
);
