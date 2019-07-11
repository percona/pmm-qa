
Feature('to verify Trends Dashboard');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Trends Dashboard', async (I, adminPage, trendsDashboardPage) => {
    await adminPage.navigateToDashboard("Insight", "Trends Dashboard");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    trendsDashboardPage.verifyMetricsExistence();
});
