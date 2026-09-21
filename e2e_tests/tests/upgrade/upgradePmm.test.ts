import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';

pmmTest.describe('PMM server upgrade tests', () => {
  pmmTest.beforeEach(async ({ context, grafanaHelper, page }) => {
    if (!process.env.PMM_SERVER_LATEST?.trim()) {
      throw new Error('PMM_SERVER_LATEST env var is required for the upgrade version check');
    }

    // pmmTest mocks the updates endpoint; the real version is needed here.
    await page.unroute(apiEndpoints.server.updates);
    await context.unroute(apiEndpoints.server.updates);
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T3 - Verify user is able to Upgrade PMM version [blocker] @pmm-upgrade',
    async ({ updatesPage }) => {
      const info = await updatesPage.getUpdateInfo();

      expect(info.update_available, 'An update should be available before upgrading').toBe(true);
      await updatesPage.upgrade();
    },
  );
});
