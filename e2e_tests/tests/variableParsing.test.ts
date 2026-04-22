import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

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

      const selectedService = await dashboard.selectVariableValue('Service Name');

      await expect
        .poll(() => decodeURIComponent(page.url()), {
          timeout: Timeouts.ONE_MINUTE,
        })
        .toContain(selectedService);
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('postgresql.overview');
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('postgresql.summary');
      await expect
        .poll(() => decodeURIComponent(page.url()), {
          timeout: Timeouts.ONE_MINUTE,
        })
        .toContain(selectedService);
    });

    await pmmTest.step('Verify panels have data and URL does not have broken variables', async () => {
      await dashboard.verifyAllPanelsHaveData([], Timeouts.TWO_MINUTES);
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
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('operatingsystem.memory');
      await dashboard.waitForDashboardToLoad();
      await leftNavigation.selectMenuItem('operatingsystem.summary');
      await dashboard.waitForDashboardToLoad();
      await expect(page).not.toHaveURL(/.*timezone=.*=true/);
      await expect(page).not.toHaveURL(/.*var-service_name=.*=true/);
      await expect(page).not.toHaveURL(/.*=true/);
    });
  },
);
