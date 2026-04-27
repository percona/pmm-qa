Feature('VictoriaMetrics Dashboards');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T506 - Verify metrics on VictoriaMetrics dashboard @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    I.amOnPage(dashboardPage.victoriaMetricsDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.victoriaMetricsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
  },
);

Scenario(
  'PMM-T507 Verify metrics on VM Agents Overview Dashboard @nightly @dashboards @gssapi-nightly',
  async ({ I, dashboardPage }) => {
    I.amOnPage(dashboardPage.victoriaMetricsAgentsOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();

    // Scroll till the end to see all graphs as there are no collapsed rows
    await I.asyncWaitFor(async () => {
      I.pressKey('PageDown');

      return (await I.grabNumberOfVisibleElements(dashboardPage.graphsLocator('Network  Usage')));
    }, 90);
    await dashboardPage.verifyMetricsExistence(dashboardPage.victoriaMetricsAgentsOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
  },
);
