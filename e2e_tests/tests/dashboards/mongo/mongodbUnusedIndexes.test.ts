import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const unusedIndexDb = 'pmm_qa_unused_idx';
const unusedIndexCollection = 'users';
const unusedIndexField = 'unused_field_qa';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.describe('MongoDB Unused Indexes @mongodb-exporter', () => {
  pmmTest.beforeAll(async ({ mongoDbHelper }) => {
    await mongoDbHelper.ensureUnusedIndex({
      collectionName: unusedIndexCollection,
      dbName: unusedIndexDb,
      indexField: unusedIndexField,
    });
  });

  pmmTest(
    'PMM-15071 Verify MongoDB Unused Indexes dashboard panels and metrics',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
      const { unusedIndexes } = dashboard.mongo;

      await page.goto(
        urlHelper.buildUrlWithParameters(unusedIndexes.url, {
          cluster: 'replicaset',
          database: unusedIndexDb,
          from: 'now-1h',
          replicationSet: 'rs',
          serviceName: service_name,
        }),
      );

      await dashboard.verifyMetricsPresent(unusedIndexes.metrics);
      await dashboard.verifyAllPanelsHaveData(unusedIndexes.noDataMetrics);
      await dashboard.verifyPanelValues(unusedIndexes.metricsWithData);

      await pmmTest.step('Unused Indexes stat reports at least one candidate', async () => {
        const panel = dashboard.builders.panelByName('Unused Indexes');

        await expect(async () => {
          const value = Number.parseInt((await panel.innerText()).match(/\d+/)?.[0] ?? '0', 10);

          expect(value).toBeGreaterThan(0);
        }).toPass({ timeout: Timeouts.TWO_MINUTES });
      });

      await pmmTest.step('Unused Indexes table lists the seeded unused index', async () => {
        const tablePanel = dashboard.builders.panelByName('Unused Indexes by Collection');

        await expect(async () => {
          await expect(tablePanel).toContainText(unusedIndexField);
        }).toPass({ timeout: Timeouts.TWO_MINUTES });
      });
    },
  );
});
