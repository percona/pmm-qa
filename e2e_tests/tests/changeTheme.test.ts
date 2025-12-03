import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";


pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('')
    await grafanaHelper.authorize();
    await page.waitForLoadState('domcontentloaded');
});

pmmTest('PMM-T2096 - Verify theme change functionality via change to dark/light theme button',
    async ({ page, themePage }) => {

        for (let i = 0; i < 2; i++) {

            await themePage.clickAccountNavItem();

            const previousBgColor = await themePage.getBackgroundColor();
            const previousThemeButtonText = await themePage.getThemeButtonText();

            await themePage.clickChangeThemeButton();

            await expect.poll(() => {
                return themePage.getBackgroundColor();
            }).not.toBe(previousBgColor);

            await expect.poll(() => {
                return themePage.getThemeButtonText();
            }).not.toBe(previousThemeButtonText);

            const newBgColor = await themePage.getBackgroundColor();

            await themePage.clickHelpNavItem();

            const helpBgColor = await themePage.getBackgroundColor();
            expect(helpBgColor).toBe(newBgColor);
        }
    })