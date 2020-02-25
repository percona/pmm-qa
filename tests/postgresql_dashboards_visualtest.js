Feature('To Compare Dashboard Screenshots for PostgreSQL Folder');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Compare PostgreSQL Instance Summary Dashboard', async (I, adminPage, postgresqlOverviewPage) => {
    let screenshot_name = "postgresql_instance_summary.png";
    adminPage.openDashboard(postgresqlOverviewPage.instanceSummaryUrl);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare PostgreSQL Instances Compare Dashboard', async (I, adminPage, postgresqlOverviewPage) => {
    let screenshot_name = "postgresql_instances_compare.png";
    adminPage.openDashboard(postgresqlOverviewPage.instancesCompareUrl);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow();
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare PostgreSQL Instances Overview Dashboard First Half', async (I, adminPage, postgresqlOverviewPage) => {
    let screenshot_name = "postgresql_instances_overview_first_half.png";
    adminPage.openDashboard(postgresqlOverviewPage.instancesOverviewUrl);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(1);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});

Scenario('Compare PostgreSQL Instances Overview Dashboard Second Half', async (I, adminPage, postgresqlOverviewPage) => {
    let screenshot_name = "postgresql_instances_overview_second_half.png";
    adminPage.openDashboard(postgresqlOverviewPage.instancesOverviewUrl);
    await adminPage.applyTimer();
    await adminPage.expandEachDashboardRow(2);
    I.saveScreenshot(screenshot_name, true);
    await I.seeVisualDiff(screenshot_name, {tolerance: 10, prepareBaseImage: false});
});
