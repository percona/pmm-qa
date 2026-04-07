import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper, page, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(page.url(), { from: 'now-1h' }));
});

pmmTest(
  'PMM-T2205 - Verify Postgres Summary service name persistence @inventory',
  async ({ dashboard, leftNavigation, page }) => {
    await pmmTest.step('Open PostgreSQL menu and go to Summary', async () => {
      await leftNavigation.selectMenuItem('postgresql');
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('postgresql.summary');
      await dashboard.selectVariableValue('Service Name');
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('postgresql.overview');
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('postgresql.summary');
    });

    await pmmTest.step('Verify panels have data and URL does not have broken variables', async () => {
      await dashboard.verifyAllPanelsHaveData([]);
      await expect(page).not.toHaveURL(/.*var-service_name=.*=true/);
      await expect(page).not.toHaveURL(/.*=true/);
    });
  },
);

pmmTest(
  'PMM-T2206 - Verify OS Summary Time zone Variable @inventory',
  async ({ dashboard, leftNavigation, page }) => {
    await pmmTest.step('Open OS menu and navigate to Overview', async () => {
      await leftNavigation.selectMenuItem('operatingsystem');
      await leftNavigation.selectMenuItem('operatingsystem.overview');
      await dashboard.waitForDashboardToLoad();
    });

    await pmmTest.step('Navigate to Disk, Memory and Summary', async () => {
      await leftNavigation.selectMenuItem('operatingsystem.disk');
      await leftNavigation.selectMenuItem('operatingsystem.memory');
      await leftNavigation.selectMenuItem('operatingsystem.summary');
      await expect(page).not.toHaveURL(/.*timezone=.*=true/);
      await expect(page).not.toHaveURL(/.*var-service_name=.*=true/);
      await expect(page).not.toHaveURL(/.*=true/);
    });
  },
);
