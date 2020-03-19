Feature("Test Dashboards inside the Insights Folder");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Prometheus Exporters Status Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage) => {
    I.amOnPage(dashboardPage.prometheusExporterStatusDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.verifyMetricsExistence(dashboardPage.prometheusExporterStatusDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA(1);
    await dashboardPage.verifyThereIsNoGraphsWithoutData(5);
});

Scenario('Open the Summary Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage, adminPage) => {
    I.amOnPage(dashboardPage.summaryDashboard.url);
    dashboardPage.waitForDashboardOpened();
    I.click(adminPage.fields.metricTitle);
    adminPage.peformPageDown(1);
    dashboardPage.verifyMetricsExistence(dashboardPage.summaryDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA();
    await dashboardPage.verifyThereIsNoGraphsWithoutData();
});

Scenario('Open the Prometheus Exporters Overview Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage) => {
    I.amOnPage(dashboardPage.prometheusExporterOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    dashboardPage.verifyMetricsExistence(dashboardPage.prometheusExporterOverviewDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA();
    await dashboardPage.verifyThereIsNoGraphsWithoutData();
});