
Feature('to verify ProxySQL Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the ProxySQL Overview Dashboard', async (I, adminPage, proxysqlOverviewPage) => {
    await adminPage.navigateToDashboard("HA", "ProxySQL Overview");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(5);
    proxysqlOverviewPage.verifyMetricsExistence();
});
