
Feature("Test Dashboards inside the Insights Folder");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open Advanced Exploration Dashboard and verify Metrics are present and graphs are displayed',
        async (I, dashboardPage) => {
    I.amOnPage(dashboardPage.advancedDataExplorationDashboard.url);
    dashboardPage.waitForDashboardOpened();
    dashboardPage.verifyMetricsExistence(dashboardPage.advancedDataExplorationDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA();
    await dashboardPage.verifyThereIsNoGraphsWithoutData();
});

Scenario('Open Prometheus Dashboard and verify Metrics are present and graphs are displayed',
        async (I, adminPage, dashboardPage) => {
    I.amOnPage(dashboardPage.prometheusDashboard.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.verifyMetricsExistence(dashboardPage.prometheusDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA(9);
    await dashboardPage.verifyThereIsNoGraphsWithoutData();
});