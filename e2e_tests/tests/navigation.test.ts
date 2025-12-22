import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }, testInfo) => {
    if (testInfo.title.includes('RBAC/permissions')) {
        return;
    }
    await page.goto('');
    await grafanaHelper.authorize();
    await page.waitForLoadState('domcontentloaded');
});

pmmTest('verify left menu sidebar collapse and expand', async ({ page, leftNavigation }) => {

    const pmmLogo = leftNavigation.elements.sidebar.locator('rect');

    await expect(leftNavigation.elements.sidebar).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).not.toBeVisible();

    await leftNavigation.elements.closeLeftNavigationButton.click();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).not.toBeVisible();

    await page.reload();
    await expect(leftNavigation.elements.openLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.closeLeftNavigationButton).not.toBeVisible();

    const rectBox = await pmmLogo.boundingBox();
    if (rectBox) {
        await page.mouse.move(
            rectBox.x + rectBox.width / 2,
            rectBox.y + rectBox.height / 2
        );
    }

    await leftNavigation.elements.openLeftNavigationButton.click();
    await expect(leftNavigation.elements.closeLeftNavigationButton).toBeVisible();
    await expect(leftNavigation.elements.openLeftNavigationButton).not.toBeVisible();
});

pmmTest('Traverse all the menu items in left menu sidebar', async ({ page, leftNavigation }) => {

    pmmTest.slow(); // Test is taking so long to run due to many menu items

    if (await leftNavigation.elements.openLeftNavigationButton.isVisible()) {
        await leftNavigation.elements.openLeftNavigationButton.click();
    }

    await leftNavigation.traverseAllMenuItems();
});

pmmTest('RBAC/permissions', async ({ page, leftNavigation }) => {

    await page.goto('');
    await leftNavigation.loginUser('admin', process.env.ADMIN_PASSWORD! || 'admin');
    if (await leftNavigation.elements.skipButton.isVisible()) {
        await leftNavigation.elements.skipButton.click();
    }
    await leftNavigation.elements.usersAndAccess.click();

    await leftNavigation.createNonAdminUser();
    await leftNavigation.elements.accounts.click();
    await leftNavigation.elements.accountsMenu.signOut.click();

    await leftNavigation.loginUser('nonadmin', 'nonadmin');
    await expect(leftNavigation.elements.configuration).not.toBeVisible();
    await leftNavigation.elements.help.click();
    await expect(leftNavigation.elements.dumpLogs).not.toBeVisible();

});

pmmTest('121 - verify custom time range persists on any dashboard', async ({ page, leftNavigation }) => {
    const expectedTimeRange = 'Last 15 minutes';

    await leftNavigation.elements.home.click();
    await leftNavigation.elements.timePickerOpenButton.click();
    await leftNavigation.getTimeRangeOption(expectedTimeRange).click();

    await leftNavigation.verifyTimeRangePersistence(expectedTimeRange);
});
