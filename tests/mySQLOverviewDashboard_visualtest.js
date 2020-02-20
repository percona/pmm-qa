Feature('MySQL Overview Dashboard Screenshot Comparing');

Scenario('Open MySQL Overview Dashboard, take screenshots of Graphs and compare it @visual-test', async (I,loginPage, pmmSettingsPage, adminPage, mysqlOverviewPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(mysqlOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    await adminPage.handleLazyLoading(10);
    I.click(mysqlOverviewPage.fields.systemChartsToggle);
    await mysqlOverviewPage.createEachPanelScreenshot();
    await mysqlOverviewPage.compareEachScreenshot();
});