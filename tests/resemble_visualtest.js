Feature('To test screen comparison with resemble Js Example test');

Scenario('Compare Mysql Overview Dashboard @visual-test', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(mysqlOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer("1m");
    I.wait(5);
    I.saveScreenshot("mysql_overview_dashboard.png", true);
    I.click(mysqlOverviewPage.fields.systemChartsToggle);
    I.seeVisualDiff("mysql_overview_dashboard.png", {tolerance: 5, prepareBaseImage: true});
});
