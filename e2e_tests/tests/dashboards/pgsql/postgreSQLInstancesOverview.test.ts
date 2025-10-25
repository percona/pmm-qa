import pmmTest from '../../../fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest('PMM-T999 - ', async ({ page, dashboard, postgresqlInstancesOverviewDashboard, urlHelper }) => {
  const url = urlHelper.buildUrlWithParameters(postgresqlInstancesOverviewDashboard.url, { from: 'now-15m' });
  await page.goto(url);
  await dashboard.verifyMetricsPresent(postgresqlInstancesOverviewDashboard.metrics);
  await dashboard.verifyAllPanelsHaveData(postgresqlInstancesOverviewDashboard.noDataMetrics);
  await dashboard.verifyPanelValues(postgresqlInstancesOverviewDashboard.metrics);
});
