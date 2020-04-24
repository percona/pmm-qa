Feature('to verify monitoried Remote Db instances');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

xScenario('Open Remote Instance Page and Add mysql instances @pmm-pre-update', async (I, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_test";
    let version = "old";
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilOldRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mysql');
    remoteInstancesPage.fillRemoteMySQLFields(mysql_service_name);
    remoteInstancesPage.createRemoteMySQL(mysql_service_name, version);
    pmmInventoryPage.verifyOldMySQLRemoteServiceIsDisplayed(mysql_service_name);
    await pmmInventoryPage.verifyAgentHasStatusRunning(mysql_service_name, version);
});

xScenario('Verify is the remote instances are in Running Status @pmm-post-update', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_test";
    let version = "new";
    I.amOnPage(pmmInventoryPage.url);
    pmmInventoryPage.verifyMySQLRemoteServiceIsDisplayed(mysql_service_name);
    await pmmInventoryPage.verifyAgentHasStatusRunning(mysql_service_name, version);

});

xScenario('Open Remote Instance Page and Add mysql instances PMM Latest', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_new";
    let version = "new";
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilNewRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mysql');
    remoteInstancesPage.fillRemoteMySQLFields(mysql_service_name);
    remoteInstancesPage.createRemoteMySQL(mysql_service_name, version);
    pmmInventoryPage.verifyMySQLRemoteServiceIsDisplayed(mysql_service_name);
    await pmmInventoryPage.verifyAgentHasStatusRunning(mysql_service_name, version);

});

xScenario('Open Remote Instance Page and Add MongoDB instances PMM Latest', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mongodb_remote_new";
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilNewRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('mongodb');
    //need to be add method for create and verification after I got credentials
});

xScenario('Open Remote Instance Page and Add PostgreSQL instances PMM Latest', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "postgresql_remote_new";
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilNewRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('postgresql');
    //need to be add methods for create and verification after I got credentials
});

Scenario('Open Remote Instance Page and Add ProxySQL instances PMM Latest', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "proxysql_remote_new";
    I.amOnPage(remoteInstancesPage.url);
    remoteInstancesPage.waitUntilNewRemoteInstancesPageLoaded();
    remoteInstancesPage.openAddRemotePage('proxysql');
    //need to be add methods for create and verification after I got credentials
});