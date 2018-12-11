
Feature('to verify MongoDB Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the MongoDB Overview Dashboard', async (I, adminPage, mongodbOverviewPage) => {
    adminPage.navigateToDashboard("MongoDB", "MongoDB Overview");
    mongodbOverviewPage.verifyMetricsExistence();
});
