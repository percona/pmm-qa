Feature('Tests for Operation System Dashboards');

const dockerVersion = 'perconalab/pmm-client:3-dev-latest';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1642 - Verify that filtering by Environment works OS dashboards @docker-configuration',
  async ({ I, dashboardPage }) => {
    const expectedEnvName = 'dev';

    await I.verifyCommand(`sudo pmm-admin config --custom-labels=environment=${expectedEnvName}`);
    await I.wait(60);
    await I.amOnPage(I.buildUrlWithParams(dashboardPage.osNodesOverview.clearUrl, {
      from: 'now-5m',
      environment: expectedEnvName,
    }));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(4);
  },
);
