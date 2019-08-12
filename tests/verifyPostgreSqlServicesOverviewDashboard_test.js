
Feature('to verify Postgre Sql Service Overview Dashboard');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Postgre Sql Service Overview Dashboard', async (I, adminPage, postgreSqlServicesOverviewPage) => {
    I.amOnPage(postgreSqlServicesOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(2);
    postgreSqlServicesOverviewPage.openPanels();
    await adminPage.handleLazyLoading(15);
    postgreSqlServicesOverviewPage.verifyMetricsExistence();
});