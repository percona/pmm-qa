const assert = require('assert');

const { leftNavMenu } = inject();

const sidebar = new DataTable(['name', 'path', 'click']);

const parse = (obj) => {
  if (obj !== null && typeof obj === 'object') {
    if ('path' in obj && 'click' in obj
      // excludes top level clickable icon
      && 'label' in obj) {
      sidebar.add([obj.label, obj.path, obj.click]);
    }

    Object.values(obj).forEach((value) => {
      // key is either an array index or object key
      parse(value);
    });
  }
};

parse(leftNavMenu);

Feature('Left Navigation menu tests').retry(1);

Before(async ({ I }) => {
  await I.Authorize();
  await I.usePlaywrightTo('Mock Updates for Help Menu', async ({ page }) => {
    await page.route('**/v1/server/updates?force=**', (route) => route.fulfill({
      status: 200,
      body: JSON.stringify({
        last_check: new Date().toISOString(),
        installed: { timestamp: new Date().toISOString() },
        latest: { timestamp: new Date().toISOString() },
        update_available: false,
      }),
    }));
  });
});
/**
Data(sidebar).Scenario(
  'PMM-T433, PMM-T591 - Verify menu items on Grafana sidebar redirects to correct page @menu',
  async ({ I, homePage, current }) => {
    await homePage.open();
    await homePage.openLeftMenu();
    current.click();
    I.waitInUrl(current.path, 5);
  },
);
*/
// TODO: Needs to be removed, Advisors are on by default hence no settings link anymore
xScenario(
  'PMM-T1051 - Verify PMM Settings page is opened from Home dashboard @menu',
  async ({ I, homePage, pmmSettingsPage }) => {
    await homePage.open();

    const tabsCount1 = await I.grabNumberOfOpenTabs();

    I.click(homePage.fields.failedSecurityChecksPmmSettingsLink);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();

    const tabsCount2 = await I.grabNumberOfOpenTabs();

    assert.ok(tabsCount1 === tabsCount2, 'Settings page isn\'t opened in the same tab');
  },
);

Scenario(
  'PMM-T1830 - Verify downloading server diagnostics logs @menu',
  async ({ I, homePage, serverApi }) => {
    I.amOnPage('pmm-ui/help');
    const path = await I.downloadFile(homePage.buttons.pmmLogs);

    await I.seeEntriesInZip(path, ['pmm-agent.yaml', 'pmm-managed.log', 'pmm-agent.log']);

    if ((await serverApi.getPmmVersion()).minor > 40) {
    /* PMM-T1830 alertmanager as been removed since 2.41.0 */
    /* note that 'alertmanager.ini',  'alertmanager.log' are still present in zip */
      await I.dontSeeEntriesInZip(path, ['alertmanager.yml', 'alertmanager.base.yml']);
    }
  },
).config('Playwright', { waitForNavigation: 'load' });
