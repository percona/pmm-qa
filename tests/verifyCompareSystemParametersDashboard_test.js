
Feature('to verify Compare System Parameters Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Compare System Parameters Dashboard', async (I, adminPage, compareSystemParametersPage) => {
    adminPage.navigateToDashboard("OS", "Compare System Parameters");
    adminPage.applyTimer("1m");
    compareSystemParametersPage.verifyMetricsExistence();
});
