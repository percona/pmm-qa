Feature('To test screen comparison with resemble Js Example test');

Scenario('Open the System Overview Dashboard and take CPU Usage Screenshot @visual-test', async (I, adminPage, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    adminPage.navigateToDashboard("OS", "System Overview");
    adminPage.applyTimer("1m");
    adminPage.viewMetric("CPU Usage");
    I.saveScreenshot("System_Overview_CPU_Usage.png");
});

Scenario('Compare CPU Usage Images @visual-test', async (I) => {
    I.verifyMisMatchPercentage("System_Overview_CPU_Usage.png", "System_Overview_CPU_Usage.png", "DiffImage_SystemOverview_CPU_USAGE_Dashboard", 5, true);
});
