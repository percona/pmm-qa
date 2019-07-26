
Feature('to verify MongoDB Cluster Summary Dashboard');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the MongoDB Cluster Summary Dashboard', async (I, adminPage, mondodbClusterSummaryPage) => {
    I.amOnPage(mondodbClusterSummaryPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(4);
    mondodbClusterSummaryPage.verifyMetricsExistence();
});
