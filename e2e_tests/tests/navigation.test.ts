import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
    await page.waitForLoadState('domcontentloaded');
});

pmmTest('verify left menu sidebar collapse and expand', async ({ page, leftNavigation }) => {

    await expect(leftNavigation.elements.sidebar).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).not.toBeVisible();

    await leftNavigation.elements.closeLeftNavigationButton.click();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).not.toBeVisible();

    await page.reload();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).not.toBeVisible();

    await leftNavigation.mouseHoverOnPmmLogo();

    await leftNavigation.elements.openLeftNavigationButton.click();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).not.toBeVisible();
});

pmmTest('Traverse all the menu items in left menu sidebar', async ({ leftNavigation }) => {

    pmmTest.slow(); // Test is taking so long to run due to many menu items

    if (await leftNavigation.elements.openLeftNavigationButton.isVisible()) {
        await leftNavigation.elements.openLeftNavigationButton.click();
    }

    await leftNavigation.traverseAllMenuItems();
});

pmmTest('RBAC/permissions', async ({ leftNavigation, grafanaHelper }) => {

    await leftNavigation.elements.usersAndAccess.click();
    await grafanaHelper.createUser('nonadmin', 'nonadmin');

    await leftNavigation.elements.accounts.click();
    await leftNavigation.elements.accountsMenu.signOut.click();

    await grafanaHelper.authorize('nonadmin', 'nonadmin');
    await expect(leftNavigation.elements.configuration).not.toBeVisible();
    await leftNavigation.elements.help.click();
    await expect(leftNavigation.elements.dumpLogs).not.toBeVisible();

});

pmmTest('verify custom time range persists on any dashboard', async ({ page, leftNavigation }) => {
    const selectedTimeRange = 'Last 15 minutes';

    await leftNavigation.elements.home.click();
    await leftNavigation.elements.timePickerOpenButton.click();
    await leftNavigation.getTimeRangeOption(selectedTimeRange).click();
    await page.waitForLoadState('domcontentloaded');
    await leftNavigation.verifyTimeRangePersistence(selectedTimeRange);
});

pmmTest('Grafana embedding', async ({ leftNavigation }) => {

    await expect(leftNavigation.elements.oldLeftMenu).not.toBeVisible();

    await leftNavigation.elements.help.click();
    await expect(leftNavigation.elements.iframe).not.toBeVisible();

    await leftNavigation.elements.home.click();
    await expect(leftNavigation.elements.iframe).toBeVisible();
    await leftNavigation.elements.help.click();
    await expect(leftNavigation.elements.iframe).toBeVisible();
});