import pmmTest from '../../../fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T305 - Open the MongoDB Instance Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
  async ({ page, dashboard, urlHelper, mysqlInstanceSummaryDashboard }) => {
    const url = urlHelper.buildUrlWithParameters(mysqlInstanceSummaryDashboard.url, { from: 'now-15m' });
    await page.goto(url);
    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(mysqlInstanceSummaryDashboard.metrics);
    await dashboard.verifyAllPanelsHaveData(mysqlInstanceSummaryDashboard.noDataMetrics);
  },
);
