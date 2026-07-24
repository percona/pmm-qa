Feature('Advisors tests');

let failedAdvisorName;

Before(async ({ I, settingsAPI, advisorsAPI }) => {
  await I.Authorize();
});

AfterSuite(async ({ advisorsAPI }) => {
  await advisorsAPI.enableCheck(failedAdvisorName);
});

Scenario(
  'PMM-T585 - Verify user is able enable/disable advisors @advisors',
  async ({
    I, advisorsPage, advisorsAPI,
  }) => {
    // Get failing advisor
    advisorsPage.runAllAdvisors();
    I.amOnPage(advisorsPage.url);
    I.waitForVisible(advisorsPage.elements.tableRow(1));
    I.click(advisorsPage.elements.tableRow(1));
    failedAdvisorName = await I.grabTextFrom(advisorsPage.elements.failedAdvisorName(1));
    const failedAdvisorCategory = await advisorsAPI.getAdvisorCategory(failedAdvisorName);
    const failedAdvisorDetails = await advisorsAPI.getAdvisorDetails(failedAdvisorName);

    // Verify that after disabling advisor will be NOT triggered
    I.amOnPage(advisorsPage.getUrlByCategory(failedAdvisorCategory));
    await advisorsPage.openAllCategories();
    I.click(advisorsPage.elements.disableAdvisor(failedAdvisorDetails.summary));
    I.waitForVisible(advisorsPage.elements.enableAdvisor(failedAdvisorDetails.summary));
    advisorsPage.runAllAdvisors();
    I.wait(60);
    I.amOnPage(advisorsPage.url);
    await advisorsPage.verifyAdvisorIsNotFailed(failedAdvisorName);

    // Verify that after enabling advisor will be triggered
    I.amOnPage(advisorsPage.getUrlByCategory(failedAdvisorCategory));
    await advisorsPage.openAllCategories();
    I.click(advisorsPage.elements.enableAdvisor(failedAdvisorDetails.summary));
    advisorsPage.runAllAdvisors();
    I.wait(60);
    I.amOnPage(advisorsPage.url);
    await advisorsPage.verifyAdvisorIsFailed(failedAdvisorName);
  },
);
