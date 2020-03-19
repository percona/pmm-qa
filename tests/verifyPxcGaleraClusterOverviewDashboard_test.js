
Feature('to verify PXC/Galera Cluster Oveview Dashboard');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the PXC/Galera Cluster Summary Dashboard and verify Metrics are present and graphs are displayed',
        async (I, adminPage, dashboardPage) => {
    I.amOnPage(dashboardPage.pxcGaleraClusterSummaryDashboard.url);
    dashboardPage.waitForDashboardOpened();
    I.click(adminPage.fields.metricTitle);
    adminPage.peformPageDown(1);
    dashboardPage.verifyMetricsExistence(dashboardPage.pxcGaleraClusterSummaryDashboard.metrics);
    await dashboardPage.verifyThereIsNoGraphsWithNA();
    await dashboardPage.verifyThereIsNoGraphsWithoutData();
});
