Feature('Test Dashboards inside the Insights Folder');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'Open Advanced Exploration Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    I.amOnPage(dashboardPage.advancedDataExplorationDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyMetricsExistence(dashboardPage.advancedDataExplorationDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
  },
);

Scenario(
  'Open the Prometheus Exporters Status Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    I.amOnPage(I.buildUrlWithParams(dashboardPage.prometheusExporterStatusDashboard.cleanUrl, {
      node_name: 'pmm-server',
      from: 'now-5m',
    }));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.prometheusExporterStatusDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(40);
  },
);

Scenario(
  'PMM-T300 - Open the Prometheus Exporters Overview Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    I.amOnPage(I.buildUrlWithParams(dashboardPage.prometheusExporterOverviewDashboard.cleanUrl, {
      node_name: 'pmm-server',
      from: 'now-5m',
    }));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyMetricsExistence(dashboardPage.prometheusExporterOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);
