import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, rtaMain }) => {
  await page.goto('');
  await grafanaHelper.authorize();
  await page.goto(rtaMain.pageUrl);
});

pmmTest('PMM-T2147 Verify Stored metrics and Real-Time tabs visibility @rta', async ({ rtaMain }) => {
  await pmmTest.step('Verify Stored metrics and Real-Time tabs are visible', async () => {
    await expect(rtaMain.buttons.realTimeTab).toBeVisible();
    await expect(rtaMain.buttons.storedMetricsTab).toBeVisible();
  });
});

pmmTest(
  'PMM-T2148 verify navigation and routing when switching tabs + PMM-T2149 verify selected tab persists after refresh + PMM-T2152 iframe persistence @rta',
  async ({ page, rtaMain }) => {
    await pmmTest.step('Verify iframe is visible on Stored metrics', async () => {
      await expect(rtaMain.elements.iframe).toBeVisible();
    });

    await pmmTest.step('Switch to Real-Time tab and verify URL and iframe persistence', async () => {
      await rtaMain.switchTab('Real-Time');
      await expect(page).toHaveTitle(/Query Analytics/);
      await expect(rtaMain.elements.iframe).toBeAttached();
    });

    await pmmTest.step('Reload page and verify tab persists', async () => {
      const realTimeUrl = page.url();

      await page.reload();
      await expect(page).toHaveURL(realTimeUrl);
      await rtaMain.verifyTabIsSelected('Real-Time');
    });

    await pmmTest.step('Switch back to Stored metrics and verify URL and iframe persistence', async () => {
      await rtaMain.switchTab('Stored metrics');
      await expect(page).toHaveTitle(/Query Analytics/);
      await expect(rtaMain.elements.iframe).toBeVisible();
    });

    await pmmTest.step('Reload page and verify Stored metrics persists', async () => {
      const storedMetricsUrl = page.url();

      await page.reload();
      await rtaMain.noSpinner();
      await expect(page).toHaveURL(storedMetricsUrl);
      await rtaMain.verifyTabIsSelected('Stored metrics');
      await expect(rtaMain.elements.iframe).toBeVisible();
    });
  },
);

// Note: verify copy links on both tabs is part of another ticket PMM-14758
