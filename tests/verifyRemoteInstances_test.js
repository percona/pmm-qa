
Feature('to verify monitoried Remote Db instances');

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open Remote Instance Page and Add mysql instances @pmm-pre-update @visual-test', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_test";
    I.amOnPage(remoteInstancesPage.url);
    I.waitForText(remoteInstancesPage.fields.pageHeaderText, 60);
    I.see(remoteInstancesPage.fields.pageHeaderText);
    await I.waitForElement(remoteInstancesPage.fields.iframe, 60);
    await I.switchTo(remoteInstancesPage.fields.iframe); // switch to first iframe
    I.waitForText(remoteInstancesPage.fields.remoteInstanceTitle, 60);
    remoteInstancesPage.addMySQLRemote(mysql_service_name);
    I.waitForElement(pmmInventoryPage.fields.iframe, 60);
    await I.switchTo(pmmInventoryPage.fields.iframe);
    I.waitForElement(pmmInventoryPage.fields.inventoryTableColumn, 60);
    adminPage.peformPageDown(5);
    I.see(mysql_service_name, pmmInventoryPage.fields.inventoryTableColumn);
    let serviceID = await pmmInventoryPage.getServiceId(mysql_service_name);
    await pmmInventoryPage.checkAgentStatus(serviceID);
});


Scenario('Verify is the remote instances are in Running Status @pmm-post-update @visual-test', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_test";
    I.amOnPage(pmmInventoryPage.url);
    I.waitForElement(pmmInventoryPage.fields.inventoryTableColumn, 60);
    await adminPage.peformPageDown(5);
    I.see(mysql_service_name, pmmInventoryPage.fields.inventoryTableColumn);
    let serviceID = await pmmInventoryPage.getServiceId(mysql_service_name);
    await pmmInventoryPage.checkAgentStatus(serviceID);
});

Scenario('Open Remote Instance Page and Add mysql instances PMM Latest', async (I, adminPage, remoteInstancesPage, pmmInventoryPage) => {
    let mysql_service_name = "mysql_remote_test_2";
    I.amOnPage(remoteInstancesPage.url);
    I.waitForText(remoteInstancesPage.fields.pageHeaderText, 60);
    I.see(remoteInstancesPage.fields.pageHeaderText);
    I.waitForText(remoteInstancesPage.fields.remoteInstanceTitle, 60);
    remoteInstancesPage.addMySQLRemoteLatest(mysql_service_name);
    I.waitForElement(pmmInventoryPage.fields.inventoryTableColumn, 60);
    adminPage.peformPageDown(5);
    I.see(mysql_service_name, pmmInventoryPage.fields.inventoryTableColumn);
    let serviceID = await pmmInventoryPage.getServiceId(mysql_service_name);
    await pmmInventoryPage.checkAgentStatus(serviceID);
});