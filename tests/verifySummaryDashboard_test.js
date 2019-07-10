
Feature('to verify Summary Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Summary Dashboard', async (I, adminPage, summaryDashboardPage) => {
    adminPage.navigateToDashboard("Insight", "Summary Dashboard");
    adminPage.applyTimer("1m");
    summaryDashboardPage.verifyMetricsExistence();
});
