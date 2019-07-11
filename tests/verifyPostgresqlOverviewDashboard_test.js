
Feature('to verify PostgreSQL Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the PostgreSQL Overview Dashboard', async (I, adminPage, postgresqlOverviewPage) => {
    await adminPage.navigateToDashboard("PostgreSQL", "PostgreSQL Overview");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    postgresqlOverviewPage.verifyMetricsExistence();
});
