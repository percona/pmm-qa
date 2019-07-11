
Feature('to verify Summary Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Summary Dashboard', async (I, adminPage, summaryDashboardPage) => {
    await adminPage.navigateToDashboard("Insight", "Summary Dashboard");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    summaryDashboardPage.verifyMetricsExistence();
});
