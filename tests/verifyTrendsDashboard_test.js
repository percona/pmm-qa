
Feature('to verify Trends Dashboard');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Trends Dashboard', async (I, adminPage, trendsDashboardPage) => {
    adminPage.navigateToDashboard("Insight", "Trends Dashboard");
    adminPage.applyTimer("1m");
    trendsDashboardPage.verifyMetricsExistence();
});
