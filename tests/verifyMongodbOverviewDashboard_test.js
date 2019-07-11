
Feature('to verify MongoDB Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the MongoDB Overview Dashboard', async (I, adminPage, mongodbOverviewPage) => {
    await adminPage.navigateToDashboard("MongoDB", "MongoDB Overview");
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    mongodbOverviewPage.verifyMetricsExistence();
});
