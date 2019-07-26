
Feature('to verify Prometheus Exporter Overview Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the Prometheus Exporter Overview Dashboard', async (I, adminPage, prometheusExporterOverviewPage) => {
    I.amOnPage(prometheusExporterOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(4);
    prometheusExporterOverviewPage.verifyMetricsExistence();
});
