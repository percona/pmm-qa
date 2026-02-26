import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, queryAnalytics }) => {
  await page.goto('');
  await grafanaHelper.authorize();
  await page.goto(queryAnalytics.url);
  await queryAnalytics.storedMetrics.elements.firstRow.waitFor({ state: 'visible' });
});

pmmTest('PMM-T2147 Verify Stored metrics and Real-Time tabs visibility @rta', async ({ queryAnalytics }) => {
  await pmmTest.step('Verify Stored metrics and Real-Time tabs are visible', async () => {
    await expect(queryAnalytics.buttons.realTimeTab).toBeVisible();
    await expect(queryAnalytics.buttons.storedMetricsTab).toBeVisible();
  });
});

pmmTest(
  'PMM-T2148 verify navigation and routing when switching tabs @rta',
  async ({ page, queryAnalytics }) => {
    await pmmTest.step('Switch to Real-Time tab and verify title', async () => {
      await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
      await expect(queryAnalytics.elements.pageTitle.first()).toBeVisible();
      await expect(page).toHaveURL(queryAnalytics.rtaUrlPattern);
    });

    await pmmTest.step('Switch back to Stored metrics and verify title', async () => {
      await queryAnalytics.switchTab(queryAnalytics.tabNames.storedMetrics);
      await expect(queryAnalytics.elements.pageTitle.first()).toBeVisible();
      await expect(page).toHaveURL(queryAnalytics.storedMetricsUrlPattern);
    });
  },
);

pmmTest('PMM-T2149 verify selected tab persists after refresh @rta', async ({ page, queryAnalytics }) => {
  await pmmTest.step('Switch to Real-Time tab, reload and verify it persists', async () => {
    await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
    await expect(page).toHaveURL(queryAnalytics.rtaUrlPattern);

    await page.reload();
    await expect(page).toHaveURL(queryAnalytics.rtaUrlPattern);
    await queryAnalytics.verifyTabIsSelected(queryAnalytics.tabNames.realTime);
  });

  await pmmTest.step('Switch back to Stored metrics, reload and verify it persists', async () => {
    await queryAnalytics.switchTab(queryAnalytics.tabNames.storedMetrics);
    await expect(page).toHaveURL(queryAnalytics.storedMetricsUrlPattern);

    await page.reload();
    await queryAnalytics.noSpinner();
    await expect(page).toHaveURL(queryAnalytics.storedMetricsUrlPattern);
    await queryAnalytics.verifyTabIsSelected(queryAnalytics.tabNames.storedMetrics);
  });
});

pmmTest('PMM-T2152 iframe persistence @rta', async ({ queryAnalytics }) => {
  await pmmTest.step('Verify iframe is visible on Stored metrics', async () => {
    await expect(queryAnalytics.elements.iframe).toBeVisible();
  });

  await pmmTest.step('Switch to Real-Time tab and verify iframe persistence', async () => {
    await queryAnalytics.switchTab(queryAnalytics.tabNames.realTime);
    await expect(queryAnalytics.elements.iframe).toBeAttached();
  });

  await pmmTest.step('Switch back to Stored metrics and verify iframe visibility', async () => {
    await queryAnalytics.switchTab(queryAnalytics.tabNames.storedMetrics);
    await expect(queryAnalytics.elements.iframe).toBeVisible();
  });
});

// Note: verify copy links on both tabs is part of another ticket PMM-14758
