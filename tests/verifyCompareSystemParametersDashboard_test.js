
Feature('to verify Compare System Parameters Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Compare System Parameters Dashboard and verify Metrics are present and graphs are displayed', async (I, adminPage, dashboardPage, compareSystemParametersPage) => {
    I.amOnPage(compareSystemParametersPage.url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    adminPage.peformPageDown(1);
    dashboardPage.verifyMetricsExistence(compareSystemParametersPage.metrics);
    dashboardPage.verifyThereIsNoGraphsWithNA();
});
