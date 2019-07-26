
Feature('to verify Advanced Data Exploration Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Advanced Data Exploration Dashboard', async (I, adminPage, advancedDataExplorationPage) => {
    I.amOnPage(advancedDataExplorationPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(3);
    advancedDataExplorationPage.verifyMetricsExistence();
});
