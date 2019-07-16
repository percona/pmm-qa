
Feature("To verify and test the QAN Dashboard");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the QAN Dashboard and Test for Elements', async (I, adminPage, qanPage) => {
    await adminPage.navigateToDashboard("QAN", "_PMM Query Analytics");

    within({frame: "//div[@class='panel-content']//iframe"}, () => {
        I.wait(10);
        qanPage.viewElementExistence();
        qanPage.checkForPagination();
        // qanPage.checkChangeNumResults();
    });
});