
Feature("Test Dashboards inside the Insights Folder");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open Advanced Exploration Dashboard and verify Metrics are present and graphs are displayed', async (I, adminPage, advancedDataExplorationPage, dashboardPage) => {
    I.amOnPage(advancedDataExplorationPage.url);
    dashboardPage.waitForDashboardOpened();
    dashboardPage.verifyMetricsExistence(advancedDataExplorationPage.metrics);
    dashboardPage.verifyThereIsNoGraphsWithNA();
});

Scenario('Open Prometheus Dashboard and verify Metrics are present and graphs are displayed', async (I, adminPage, prometheusPage, dashboardPage) => {
    I.amOnPage(prometheusPage.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    dashboardPage.verifyMetricsExistence(prometheusPage.metrics);
    dashboardPage.verifyThereIsNoGraphsWithNA();
});