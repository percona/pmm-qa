Feature('to verify monitoried Remote Db instances');

Scenario('Open the System Overview Dashboard', async (I, adminPage, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    adminPage.navigateToDashboard("OS", "System Overview");
    adminPage.applyTimer("1m");
    adminPage.viewMetric("CPU Usage");
    I.saveScreenshot("System_Overview_CPU_Usage.png");
    I.wait(60);
    I.amInPath('./tests/output/');
    I.seeFile('System_Overview_CPU_Usage.png');
});

Scenario('Compare CPU Usage Images', async (I) => {
    I.verifyMisMatchPercentage("System_Overview_CPU_Usage.png", "System_Overview_CPU_Usage.png", "DiffImage_SystemOverview_CPU_USAGE_Dashboard", 5);
});
