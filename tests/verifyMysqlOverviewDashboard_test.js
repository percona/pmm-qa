
Feature('to verify MySQL Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the MySQL Overview Dashboard', async (I, adminPage, mysqlOverviewPage) => {
    await adminPage.navigateToDashboard("MySQL", "MySQL Overview");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    I.click(mysqlOverviewPage.fields.systemChartsToggle);
    mysqlOverviewPage.verifyMetricsExistence();
});
