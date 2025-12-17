import pmmTest from '@fixtures/pmmTest';
import { expect, Page } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});


pmmTest('PMM-T2132 Verify welcome Card appears on fresh install', async ({ welcomePage }) => {

    await welcomePage.mockFreshInstall();
    await welcomePage.mockNoServices();

    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await expect(welcomePage.elements.addServiceButton).toBeVisible();
    await expect(welcomePage.elements.dismissButton).toBeVisible();
    await expect(welcomePage.elements.startTourButton).toBeVisible();
});

pmmTest('PMM-T2101 verify dismiss button on welcome card', async ({ page, welcomePage }) => {

    await welcomePage.mockFreshInstall();

    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await welcomePage.elements.dismissButton.click();
    await page.reload();
    await expect(welcomePage.elements.welcomeCard).not.toBeVisible();
});

pmmTest('PMM-T2133 Verify Welcome Card start tour', async ({ page, welcomePage }) => {

    await welcomePage.mockFreshInstall();

    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await welcomePage.elements.startTourButton.click();
    await expect(welcomePage.elements.tourPopover).toBeVisible();
    await welcomePage.elements.tourCloseButton.click();
    await page.reload();
    await expect(welcomePage.elements.welcomeCard).not.toBeVisible();
});

pmmTest('PMM-T2134 Verify Update check', async ({ page, welcomePage }) => {

    const cases = [
        { updateAvailable: true },
        { updateAvailable: false },
    ];

    for (const c of cases) {
        await welcomePage.mockUpdateAvailable(
            c.updateAvailable
        );

        await page.reload();

        if (c.updateAvailable) {
            await expect(welcomePage.elements.updates).toBeVisible({ timeout: 10000 });
        } else {
            await expect(welcomePage.elements.updates).not.toBeVisible({ timeout: 10000 });
        }
    }
});