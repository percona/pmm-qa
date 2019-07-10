
Feature('to verify System Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the System Overview Dashboard', async (I, adminPage, systemOverviewPage) => {
    adminPage.navigateToDashboard("OS", "System Overview");
    adminPage.applyTimer("1m");
    systemOverviewPage.verifyMetricsExistence();
});
