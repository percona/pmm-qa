import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { serverVersionBelow } from '@helpers/version.helper';

const collection = 'users';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2262 Verify MongoDB Unused Indexes dashboard @nightly @dashboards @pmm-psmdb-integration',
  async ({ api, dashboard, mongoDbHelper, page, urlHelper }) => {
    pmmTest.skip(serverVersionBelow('3.10.0'), 'MongoDB Unused Indexes dashboard is available from PMM Server 3.10.0');
    const database = `pmm_qa_unused_indexes_${Date.now()}`;
    const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
    const unusedIndexes = dashboard.mongo.unusedIndexes;

    try {
      const indexes = await mongoDbHelper.createIndexStats(database, collection);
      const metric = `mongodb_indexstats_accesses_ops{database="${database}", key_name="${indexes.unusedIndex}", service_name="${service.service_name}"}`;

      await api.grafanaApi.waitForMetric(metric, Timeouts.TWO_MINUTES);
      await page.goto(
        urlHelper.buildUrlWithParameters(unusedIndexes.url, {
          cluster: service.cluster,
          database,
          environment: service.environment,
          from: 'now-5m',
          refresh: '5s',
          replicationSet: service.replication_set,
          serviceName: service.service_name,
        }),
      );
      await dashboard.verifyAllPanelsHaveData(unusedIndexes.noDataMetrics);

      for (const panel of unusedIndexes.metrics) {
        await expect(dashboard.builders.panelByExactName(panel.name)).toHaveCount(1);
      }

      const candidates = dashboard.builders.panelByExactName('Unused Indexes by Collection');

      await expect(dashboard.builders.panelByExactName('Indexes Monitored')).toContainText('2');
      await expect(dashboard.builders.panelByExactName('Unused Indexes')).toContainText('1');
      await expect(candidates).toContainText(indexes.unusedIndex);
      await expect(candidates).not.toContainText(indexes.usedIndex);
    } finally {
      await mongoDbHelper.dropDatabase(database);
    }
  },
);
