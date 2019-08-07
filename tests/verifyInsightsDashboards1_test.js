
Feature("Test Dashboards inside the Insights Folder");

Scenario('Open Advanced Exploration, Cross ServerGraph, Prometheus Page', async (I, loginPage, adminPage, advancedDataExplorationPage, prometheusPage, crossServerGraphsPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");

    I.amOnPage(advancedDataExplorationPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    advancedDataExplorationPage.verifyMetricsExistence();
    I.amOnPage(crossServerGraphsPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    crossServerGraphsPage.verifyMetricsExistence();
    I.amOnPage(prometheusPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    for (let i in prometheusPage.panels) {
        adminPage.openPanel(prometheusPage.panels[i]);
    }
    await adminPage.handleLazyLoading(11);
    prometheusPage.verifyMetricsExistence();
});
