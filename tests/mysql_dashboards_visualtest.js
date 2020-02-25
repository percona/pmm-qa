Feature('To Compare Dashboard Screenshots for MySQL Folder');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Compare Mysql Instances Summary Dashboard', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.instanceSummaryUrl;
    let screenshot_name = "mysql_instances_summary.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Mysql Instances Compare Dashboard First Half', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.instanceCompareUrl;
    let screenshot_name = "mysql_instances_compare_first_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(1);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Mysql Instances Compare Dashboard Second Half', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.instanceCompareUrl;
    let screenshot_name = "mysql_instances_compare_second_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(2);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare Mysql Table Details Dashboard', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.tableDetailsUrl;
    let screenshot_name = "mysql_table_details.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

xScenario('Compare Mysql Instances Overview Dashboard First Half', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.instanceOverviewUrl;
    let screenshot_name = "mysql_instances_overview_first_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(1);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

xScenario('Compare Mysql Instances Overview Dashboard Second Half', async (I, adminPage, loginPage, mysqlOverviewPage) => {
    let dashboard_url = mysqlOverviewPage.instanceOverviewUrl;
    let screenshot_name = "mysql_instances_overview_second_half.png";
    adminPage.openDashboard(dashboard_url);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(1);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});
