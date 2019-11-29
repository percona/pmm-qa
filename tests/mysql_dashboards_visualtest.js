Feature('To Compare Dashboard Screenshots for MySQL Folder');

Scenario('Compare Mysql Overview Dashboard', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    I.amOnPage(mysqlOverviewPage.url);
    I.waitForElement(adminPage.fields.metricTitle, 30);
    adminPage.applyTimer();
    I.wait(5);
    I.saveScreenshot("mysql_overview_dashboard.png", true);
    I.click(mysqlOverviewPage.fields.systemChartsToggle);
    I.seeVisualDiff("mysql_overview_dashboard.png", {tolerance: 10, prepareBaseImage: false});
});
