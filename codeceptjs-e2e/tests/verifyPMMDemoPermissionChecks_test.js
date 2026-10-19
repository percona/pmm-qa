Feature('Tests for PMM Demo Sanity Tests Permissions Checks, QAN Checks Cycle');

Scenario(
  'PMM-T363 - Verify Copyrights & Legal section elements [critical] @not-pr-pipeline @pmm-demo @not-ui-pipeline',
  async ({ I, pmmDemoPage }) => {
    I.amOnPage(pmmDemoPage.url);
    I.waitForVisible(pmmDemoPage.fields.title, 30);
    pmmDemoPage.verifyCopyrightsAndLegal();
    I.amOnPage(pmmDemoPage.url + pmmDemoPage.mongoDBDashbordUrl);
    pmmDemoPage.verifyCopyrightsAndLegal();
  },
);

Scenario(
  'PMM-T364 - Verify PMM settings returns Access denied error [critical] @not-pr-pipeline @pmm-demo @not-ui-pipeline',
  async ({ I, pmmDemoPage, pmmSettingsPage }) => {
    I.amOnPage(pmmDemoPage.url + pmmSettingsPage.url);
    I.waitForVisible(pmmDemoPage.fields.noAccess, 30);
  },
);

Scenario(
  'PMM-T365 - Verify PMM settings returns Access denied error @not-pr-pipeline [critical] @pmm-demo @not-ui-pipeline',
  async ({ I, pmmDemoPage, pmmInventoryPage }) => {
    I.amOnPage(pmmDemoPage.url + pmmInventoryPage.url);
    I.waitForVisible(pmmDemoPage.fields.noAccess, 30);
  },
);

// Need to skip for update to be available on pmmdemo
xScenario(
  'PMM-T288 Verify user can see Update widget before upgrade [critical] @pmm-demo @not-ui-pipeline @not-pr-pipeline',
  async ({
    I, homePage, pmmDemoPage,
  }) => {
    I.amOnPage(pmmDemoPage.url + homePage.url);
    await homePage.verifyPostUpdateWidgetIsPresent();
  },
);
