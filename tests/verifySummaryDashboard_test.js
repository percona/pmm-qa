
Feature('to verify Summary Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Summary Dashboard', async (I, adminPage, summaryDashboardPage) => {
    I.amOnPage(summaryDashboardPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    summaryDashboardPage.verifyMetricsExistence();
});
