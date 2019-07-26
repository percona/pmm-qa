
Feature('to verify Prometheus Exporter Status Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
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
