import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM settings tests for upgrade', () => {
  const dashboardName = 'upgrade-dashboard';
  const panelName = 'Monitored DB';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T391 - Verify user is able to create and set custom home dashboard @pre-upgrade',
    async ({ dashboard, grafanaHelper, page }) => {
      const folder = await grafanaHelper.getFolderDetailsByName('Insight');

      await grafanaHelper.createFolder('upgrade-folder');

      const customDashboard = await grafanaHelper.createCustomDashboard(
        dashboardName,
        folder.id,
        `${panelName}`,
        ['pmm-qa', 'tag-upgrade'],
      );

      await grafanaHelper.starDashboard((await customDashboard.json()).uid);
      await grafanaHelper.setHomeDashboard((await customDashboard.json()).uid);

      await page.goto('pmm-ui/graph/');
      await dashboard.verifyMetricsPresent([{ name: panelName, type: 'stat' }]);
      expect(page.url()).toContain(dashboardName);
      expect(page.url()).toContain((await customDashboard.json()).uid);
      await page.goto((await grafanaHelper.getDashboard((await customDashboard.json()).uid)).meta.url);
    },
  );

  pmmTest(
    'Verify duplicate dashboard do not break upgrade @pre-upgrade',
    async ({ grafanaHelper, testState }) => {
      const insightFolder = await grafanaHelper.getFolderDetailsByName('Insight');
      const experimentalFolder = await grafanaHelper.getFolderDetailsByName('Experimental');
      const firstCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        insightFolder.id,
        panelName,
      );
      const secondCustomDashboard = await grafanaHelper.createCustomDashboard(
        'test-dashboard',
        experimentalFolder.id,
        panelName,
      );
      const firstDashboardUid = (await firstCustomDashboard.json()).uid;
      const secondDashboardUid = (await secondCustomDashboard.json()).uid;

      testState.save({
        FIRST_DASHBOARD_UID: firstDashboardUid,
        SECOND_DASHBOARD_UID: secondDashboardUid,
      });

      expect(firstDashboardUid.length).toBeGreaterThan(0);
      expect(secondDashboardUid.length).toBeGreaterThan(0);
    },
  );
});
