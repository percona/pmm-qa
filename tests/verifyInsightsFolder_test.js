
Feature("Test Dashboards inside the Insights Folder");

Scenario('Open the Advanced Data Exploration Dashboard', async (I, loginPage, adminPage, advancedDataExplorationPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");

    I.amOnPage(advancedDataExplorationPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(3);
    advancedDataExplorationPage.verifyMetricsExistence();
});

Scenario('Open the Cross Server Graphs Dashboard', async (I, adminPage, crossServerGraphsPage) => {
    I.amOnPage(crossServerGraphsPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(3);
    crossServerGraphsPage.verifyMetricsExistence();
});

Scenario('Open the Prometheus Dashboard', async (I, adminPage, prometheusPage) => {
    I.amOnPage(prometheusPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    for (let i in prometheusPage.panels) {
        adminPage.openPanel(prometheusPage.panels[i]);
    }
    await adminPage.handleLazyLoading(11);
    prometheusPage.verifyMetricsExistence();
});

Scenario('Open the Prometheus Exporter Status Dashboard', async (I, adminPage, prometheusExporterStatusPage) => {
    I.amOnPage(prometheusExporterStatusPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    for (let i in prometheusExporterStatusPage.panels) {
        adminPage.openPanel(prometheusExporterStatusPage.panels[i]);
    }
    await adminPage.handleLazyLoading(4);
    prometheusExporterStatusPage.verifyMetricsExistence();
});

Scenario('Open the Prometheus Exporter Overview Dashboard', async (I, adminPage, prometheusExporterOverviewPage) => {
    I.amOnPage(prometheusExporterOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(4);
    prometheusExporterOverviewPage.verifyMetricsExistence();
});

Scenario('Open the Summary Dashboard', async (I, adminPage, summaryDashboardPage) => {
    I.amOnPage(summaryDashboardPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    summaryDashboardPage.verifyMetricsExistence();
});

Scenario('Open the Trends Dashboard', async (I, adminPage, trendsDashboardPage) => {
    I.amOnPage(trendsDashboardPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    trendsDashboardPage.verifyMetricsExistence();
});