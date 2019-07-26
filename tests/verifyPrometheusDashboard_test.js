
Feature('to verify Prometheus Dashboards');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
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
