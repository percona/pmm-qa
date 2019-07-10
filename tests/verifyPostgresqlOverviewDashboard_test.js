
Feature('to verify PostgreSQL Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the PostgreSQL Overview Dashboard', async (I, adminPage, postgresqlOverviewPage) => {
    adminPage.navigateToDashboard("PostgreSQL", "PostgreSQL Overview");
    adminPage.applyTimer("1m");
    postgresqlOverviewPage.verifyMetricsExistence();
});
