
Feature('to verify Trends Dashboard');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Trends Dashboard', async (I, adminPage, trendsDashboardPage) => {
    I.amOnPage(trendsDashboardPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    trendsDashboardPage.verifyMetricsExistence();
});
