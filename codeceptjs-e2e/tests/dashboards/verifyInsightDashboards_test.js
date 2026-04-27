Feature('Test Dashboards inside the Insight Folder');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario('PMM-T2043 - Verify Advanced Data Exploration dashboard for metric pg_stat_activity_max_tx_duration @nightly', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.advancedDataExplorationDashboard.cleanUrl, { metric: 'pg_stat_activity_max_tx_duration' });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.verifyMetricsExistence(dashboardPage.advancedDataExplorationDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData();
});
