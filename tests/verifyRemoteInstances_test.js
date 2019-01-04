
Feature('to verify monitoried Remote Db instances');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('open the Remote and RDS Instances Listing Page', async (I, adminPage, remoteInstancesPage) => {
    I.amOnPage(remoteInstancesPage.url);
    I.see(remoteInstancesPage.fields.pageHeaderText)
});
