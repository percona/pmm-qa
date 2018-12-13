
Feature('to verify Upgrade PMM to latest version');

Scenario('Open the home Dashboard and Execute Update', async (I, adminPage) => {
    I.amOnPage('/');
    I.wait(20);
    adminPage.checkForUpdate(true);
});
