Feature('To compare Mysql InnoDB Metrics visual testing');

Scenario('Open the Mysql InnoDB Metrics Dashboard and take screenshot @visual-test', async (I, adminPage, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
    adminPage.navigateToDashboard("MySQL", "MySQL InnoDB Metrics");
    adminPage.applyTimer("3m");

    I.click("/html/body/grafana-app/div/div/div/react-container/div/div[2]/div/div[1]/div/div[1]/dashboard-submenu/div/div[6]/dash-links-container/dash-link[2]/div/a");
    for(let i=0; i<300; i++)
        I.pressKey("ArrowDown")

    adminPage.viewMetric("InnoDB Checkpoint Age");
    I.saveScreenshot("mysql_innodb_checkpoint_age.png");
    I.click(adminPage.fields.backToDashboard);
    adminPage.viewMetric("InnoDB Transactions");
    I.saveScreenshot("mysql_innodb_transactions.png");
    I.click(adminPage.fields.backToDashboard);
    adminPage.viewMetric("Innodb Read-Ahead");
    I.saveScreenshot("mysql_innodb_read_ahead.png");
});

Scenario('Compare mysql_innodb_metrics with Base Image @visual-test', async (I, adminPage, loginPage) => {
    I.seeVisualDiff("mysql_innodb_read_ahead.png", {tolerance: 10, prepareBaseImage: false});
    I.seeVisualDiff("mysql_innodb_checkpoint_age.png", {tolerance: 10, prepareBaseImage: false});
    I.seeVisualDiff("mysql_innodb_transactions.png", {tolerance: 15, prepareBaseImage: false});
});
