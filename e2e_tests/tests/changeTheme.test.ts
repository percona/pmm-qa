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

            await themePage.getLocator('accountNavItem').click();

            const previousBgColor = await themePage.getBackgroundColor();
            const previousThemeButtonText = await themePage.getLocator('changeThemeButton').innerText();

            await themePage.getLocator('changeThemeButton').click();

            await expect.poll(() => {
                return themePage.getBackgroundColor();
            }).not.toBe(previousBgColor);

            await expect.poll(() => {
                return themePage.getLocator('changeThemeButton').innerText();
            }).not.toBe(previousThemeButtonText);

            const newBgColor = await themePage.getBackgroundColor();

            await themePage.getLocator('helpNavItem').click();

            const helpBgColor = await themePage.getBackgroundColor();
            expect(helpBgColor).toBe(newBgColor);
        }
    })

pmmTest('PMM- T2127 Verify interface theme combobox value in sync with background color',
    async ({ page, themePage }) => {

        await themePage.getLocator('accountNavItem').click();
        await page.waitForLoadState('domcontentloaded');

        await themePage.getLocator('changeThemeButton').click();
        const buttonText = await themePage.getLocator('changeThemeButton').innerText();

        const expected = buttonText === 'Change to Light Theme' ? 'Dark' : 'Light';
        await expect(themePage.getThemeCombobox()).toHaveValue(expected);

    })
