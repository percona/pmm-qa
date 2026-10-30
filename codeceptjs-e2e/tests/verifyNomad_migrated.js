Feature('Tests for Nomad in PMM');

BeforeSuite(async ({ I, settingsAPI, codeceptjsConfig }) => {
  await settingsAPI.changeSettings({
    publicAddress: codeceptjsConfig.config.helpers.Playwright.url.replace(/[^.\d]/g, ''),
  });
  I.wait(5);
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario('PMM-T2026 - Verify nomad client is not running if Nomad server is stopped @nomad', async ({
  I, pmmInventoryPage, settingsAPI,
}) => {
  I.amOnPage(pmmInventoryPage.nodesTab.url);
  await pmmInventoryPage.pagination.selectRowsPerPage('100');
  await pmmInventoryPage.nodesTab.verifyAllNodesHaveAgent('Nomad agent');
  await settingsAPI.changeSettings({ publicAddress: '' });
  I.wait(5);
  await pmmInventoryPage.nodesTab.verifyAllNodesDontHaveAgent('Nomad agent');
});
