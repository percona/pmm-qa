import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const dashboardUrl = 'graph/d/mongodb-unused-indexes/mongodb-unused-indexes';
const unusedIndexDb = 'pmm_qa_unused_idx';
const unusedIndexField = 'unused_field_qa';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-15071 Verify MongoDB Unused Indexes dashboard @mongodb-exporter',
  async ({ api, dashboard, mongoDbHelper, page, urlHelper }) => {
    await mongoDbHelper.seedUnusedIndex(unusedIndexDb, 'users', unusedIndexField);

    const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboardUrl, {
        cluster: 'replicaset',
        database: unusedIndexDb,
        from: 'now-1h',
        replicationSet: 'rs',
        serviceName: service_name,
      }),
    );

    await dashboard.waitForDashboardToLoad();

    await expect(async () => {
      await expect(dashboard.builders.panelByName('Unused Indexes by Collection')).toContainText(
        unusedIndexField,
      );
    }).toPass({ timeout: Timeouts.TWO_MINUTES });
  },
);
