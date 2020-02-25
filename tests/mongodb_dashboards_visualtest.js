Feature('To Compare Dashboard Screenshots for MongoDB Folder');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Compare MongoDB Instances Summary Dashboard', async (I, adminPage, mongodbOverviewPage) => {
    let dashboard_url = mongodbOverviewPage.instanceSummaryUrl;
    let screenshot_name = "mongodb_instances_summary.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare MongoDB Instances Compare Dashboard', async (I, adminPage, mongodbOverviewPage) => {
    let dashboard_url = mongodbOverviewPage.instanceCompareUrl;
    let screenshot_name = "mongodb_instances_compare.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

xScenario('Compare MongoDB Instances Overview Dashboard First Half', async (I, adminPage, mongodbOverviewPage) => {
    let dashboard_url = mongodbOverviewPage.instanceOverviewUrl;
    let screenshot_name = "mongodb_instances_overview_first_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(1);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

xScenario('Compare MongoDB Instances Overview Dashboard Second Half', async (I, adminPage, mongodbOverviewPage) => {
    let dashboard_url = mongodbOverviewPage.instanceOverviewUrl;
    let screenshot_name = "mongodb_instances_overview_second_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(2);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});