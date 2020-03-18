Feature("Test Dashboards inside the Insights Folder");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Prometheus Exporters Status Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage, adminPage, prometheusExporterStatusPage) => {
    I.amOnPage(prometheusExporterStatusPage.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.verifyMetricsExistence(prometheusExporterStatusPage.metrics);
});

Scenario('Open the Summary Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage, adminPage, summaryDashboardPage) => {
    I.amOnPage(summaryDashboardPage.url);
    dashboardPage.waitForDashboardOpened();
    I.click(adminPage.fields.metricTitle);
    adminPage.peformPageDown(1);
    dashboardPage.verifyMetricsExistence(summaryDashboardPage.metrics);
    dashboardPage.verifyThereIsNoGraphsWithNA();
    dashboardPage.verifyThereIsNoGraphsWithoutData();
});

Scenario('Open the Prometheus Exporters Overview Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage, adminPage, prometheusExporterOverviewPage) => {
    I.amOnPage(prometheusExporterOverviewPage.url);
    dashboardPage.waitForDashboardOpened();
    dashboardPage.verifyMetricsExistence(prometheusExporterOverviewPage.metrics);
    dashboardPage.verifyThereIsNoGraphsWithNA();
    dashboardPage.verifyThereIsNoGraphsWithoutData();
});