import pmmTest from '@fixtures/pmmTest';
import { expect, Page } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});


pmmTest('PMM-T2132 Verify welcome Card appears on fresh install', async ({ welcomePage }) => {

    await welcomePage.mockFreshInstall({
        user_id: 1,
        product_tour_completed: false,
        alerting_tour_completed: false,
    });
    await welcomePage.mockNoServices();

    await expect(welcomePage.getLocator('welcomeCard')).toBeVisible();
    await expect(welcomePage.getLocator('addServiceButton')).toBeVisible();
    await expect(welcomePage.getLocator('dismissButton')).toBeVisible();
    await expect(welcomePage.getLocator('startTourButton')).toBeVisible();
});

pmmTest('PMM-T2101 verify dismiss button on welcome card', async ({ page, welcomePage }) => {

    await welcomePage.mockFreshInstall({
        user_id: 1,
        product_tour_completed: false,
        alerting_tour_completed: false
    });

    await expect(welcomePage.getLocator('welcomeCard')).toBeVisible();
    await welcomePage.getLocator('dismissButton').click();

    await page.unroute('**/v1/users/me');
    await welcomePage.mockFreshInstall({
        user_id: 1,
        product_tour_completed: true,
        alerting_tour_completed: false
    });

    await page.reload();
    await expect(welcomePage.getLocator('welcomeCard')).not.toBeVisible();
});

pmmTest('PMM-T2133 Verify Welcome Card start tour', async ({ welcomePage }) => {

    await welcomePage.mockFreshInstall({
        user_id: 1,
        product_tour_completed: false,
        alerting_tour_completed: false
    });

    await expect(welcomePage.getLocator('welcomeCard')).toBeVisible();
    await welcomePage.getLocator('startTourButton').click();
    await expect(welcomePage.getLocator('tourPopover')).toBeVisible();
});

pmmTest('Verify Update check', async ({ welcomePage }) => {

    await welcomePage.mockUpdateAvailable();
    await expect(welcomePage.getLocator('updates')).toBeVisible({ timeout: 10000 });
});