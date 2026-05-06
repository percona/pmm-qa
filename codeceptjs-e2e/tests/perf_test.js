const assert = require('assert');

Feature('Performance test of PMM UI');

Scenario(
  'PMM-T7 Verify performance of PMM instance. @not-ui-pipeline @perf-testing',
  async ({
    I, homePage, pmmInventoryPage, pmmSettingsPage, advisorsPage,
  }) => {
    await I.Authorize();
    await I.amOnPage('');
    const newTabs = await I.openNewTabs(4);
    const addresses = [homePage.landingUrl, pmmInventoryPage.url, pmmSettingsPage.url, advisorsPage.url];

    newTabs.forEach(async (tab, index) => {
      await I.navigateTabTo(tab, addresses[index]);
      const loadTime = await I.getPageTimeToLoad(tab);

      assert.ok(parseInt(loadTime, 10) < 10000, `PMM took over 10 seconds to load for the address + ${addresses[index]}`);
    });
  },
);
