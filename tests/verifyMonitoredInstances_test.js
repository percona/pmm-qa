
Feature('to verify monitoried Db instances');

Before((I, loginPage) => {
    I.amOnPage('/');
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('open the home Dashboard and verify the count of Monitored System Instances', async (I, homePage) => {
    I.waitForVisible(homePage.fields.systemsUnderMonitoringCount, 5);
    let count = await homePage.getCount(homePage.fields.systemsUnderMonitoringCount);
    var assert = require('assert');
    assert.equal(String(count), '2');
});
