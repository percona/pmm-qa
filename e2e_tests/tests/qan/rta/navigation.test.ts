import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.describe('RTA Navigation and Persistence', () => {
  pmmTest.beforeEach(async ({ page, queryAnalytics }) => {
    await page.goto('');
    await page.goto(queryAnalytics.url);
    await queryAnalytics.storedMetrics.elements.firstRow.waitFor({
      state: 'visible',
      timeout: Timeouts.THIRTY_SECONDS,
    });
  });

  pmmTest(
    'PMM-T2147 Verify Stored metrics and Real-Time tabs visibility @rta',
    async ({ queryAnalytics }) => {
      await pmmTest.step('Verify Stored metrics and Real-Time tabs are visible', async () => {
        await expect(queryAnalytics.buttons.realTimeTab).toBeVisible();
        await expect(queryAnalytics.buttons.storedMetricsTab).toBeVisible();
      });
    },
  );

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
});

pmmTest.describe('RTA Navigation without active session', () => {
  pmmTest(
    'PMM-T2181 Verify redirect to selection page when no session exists @rta',
    async ({ page, queryAnalytics, realTimeAnalyticsPage }) => {
      await pmmTest.step('Ensure no active session exists', async () => {
        await page.goto(queryAnalytics.rtaSessionsUrl);
        await expect(page).toHaveURL(
          new RegExp(`${queryAnalytics.rtaSessionsUrl}|${queryAnalytics.rtaSelectionUrl}`),
        );

        if (page.url().includes(queryAnalytics.rtaSessionsUrl)) {
          await realTimeAnalyticsPage.stopAllSessions();
        }
      });

      await pmmTest.step('Navigate directly to /rta/overview', async () => {
        await page.goto(queryAnalytics.rta.url);
      });

      await pmmTest.step('User is directed to selection page', async () => {
        await expect(page).toHaveURL(queryAnalytics.rtaSelectionUrl, {
          timeout: Timeouts.TEN_SECONDS,
        });
        await expect(queryAnalytics.buttons.startSessionButton).toBeVisible();
      });
    },
  );
});

pmmTest.describe('RTA Navigation with active session', () => {
  pmmTest.beforeEach(async ({ api }) => {
    const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

    await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  });

  pmmTest('PMM-T2182 Verify overview loads when session exists @rta', async ({ page, queryAnalytics }) => {
    await pmmTest.step('Navigate directly to overview', async () => {
      await page.goto(queryAnalytics.rta.url);
    });

    await pmmTest.step('Overview page loads', async () => {
      await expect(queryAnalytics.rta.elements.realTimeTable).toBeVisible();
    });

    await pmmTest.step('Cluster/Service input is visible and functional', async () => {
      await expect(queryAnalytics.rta.inputs.clusterService).toBeVisible();
      await queryAnalytics.rta.inputs.clusterService.click();
      await expect(page.getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Escape');
    });
  });

  pmmTest(
    'PMM-T2195 Verify user is redirected to Sessions page when sessions are running @rta',
    async ({ helpPage, page, queryAnalytics }) => {
      await pmmTest.step('Navigate to help page', async () => {
        await page.goto(helpPage.url);
      });

      await pmmTest.step('Navigate to selection page via url', async () => {
        await page.goto(queryAnalytics.rtaSelectionUrl);
      });

      await pmmTest.step('User is redirected to the Sessions page', async () => {
        await expect(page).toHaveURL(new RegExp(queryAnalytics.rtaSessionsUrl), {
          timeout: Timeouts.TEN_SECONDS,
        });
      });
    },
  );
});
