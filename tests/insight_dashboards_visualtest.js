Feature('To Compare Dashboard Screenshots for Insights Folder');

Scenario('Compare Prometheus Dashboard', async (I, adminPage, loginPage, prometheusPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(prometheusPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer();
    for (let i in prometheusPage.panels) {
        adminPage.openPanel(prometheusPage.panels[i]);
    }
    await adminPage.handleLazyLoading(11);
    I.saveScreenshot("prometheus_dashboard.png", true);
    I.seeVisualDiff("prometheus_dashboard.png", {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Prometheus Exporter Status Dashboard', async (I, adminPage, loginPage, prometheusExporterStatusPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");

    I.amOnPage(prometheusExporterStatusPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    for (let i in prometheusExporterStatusPage.panels) {
        adminPage.openPanel(prometheusExporterStatusPage.panels[i]);
    }
    await adminPage.handleLazyLoading(10);
    I.saveScreenshot("prometheus_exporter_status_dashboard.png", true);
    I.seeVisualDiff("prometheus_exporter_status_dashboard.png", {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Prometheus Exporter Overview Dashboard', async (I, adminPage, loginPage, prometheusExporterOverviewPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");

    I.amOnPage(prometheusExporterOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    I.saveScreenshot("prometheus_exporter_overview_dashboard.png", true);
    I.seeVisualDiff("prometheus_exporter_overview_dashboard.png", {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Advanced Data Exploration Dashboard', async (I, adminPage, loginPage, advancedDataExplorationPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");

    I.amOnPage(advancedDataExplorationPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    I.saveScreenshot("advanced_data_exploration_dashboard.png", true);
    I.seeVisualDiff("advanced_data_exploration_dashboard.png", {tolerance: 10, prepareBaseImage: false});
});