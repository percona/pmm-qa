Feature("To verify and test the QAN Dashboard");

Before((I, loginPage) => {
    I.amOnPage(loginPage.url);
    loginPage.login("admin", "admin");
});

Scenario('Open the QAN Dashboard and Test for Elements', async (I, adminPage, qanPage) => {
    I.amOnPage(qanPage.url);
    await I.waitForElement(qanPage.fields.iframe, 60);
    adminPage.applyTimer("5m");
    await I.switchTo(qanPage.fields.iframe); // switch to first iframe
    I.wait(10);
    qanPage.changeResultsPerPage(50);
    qanPage.checkFilterGroups();
    qanPage.applyFilter("ps");
    await qanPage.verifyDataSet(1);
    await qanPage.verifyDataSet(2);
    await qanPage.clearFilters();
    qanPage.changeResultsPerPage(10);
    qanPage.checkPagination();
    await qanPage.checkSparkLines();
    qanPage.checkTableHeaders();
    //qanPage.checkServerList();
    I.switchTo();
});