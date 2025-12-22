import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";


pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('')
    await grafanaHelper.authorize();
    await page.waitForLoadState('domcontentloaded');
});

pmmTest('PMM-T2096 - Verify theme change functionality via change to dark/light theme button',
    async ({ page, themePage }) => {

        const darkThemeColor = 'rgb(58, 65, 81)';
        const lightThemeColor = 'rgb(240, 241, 244)';

        for (let i = 0; i < 2; i++) {

            await themePage.elements.accountNavItem.click();

            const previousBgColor = await themePage.getBackgroundColor();
            const previousThemeButtonText = await themePage.elements.changeThemeButton.innerText();

            await themePage.elements.changeThemeButton.click();

            await expect.poll(() => {
                return themePage.getBackgroundColor();
            }).not.toBe(previousBgColor);


            await expect.poll(() => {
                return themePage.elements.changeThemeButton.innerText();
            }).not.toBe(previousThemeButtonText);

            const newBgColor = await themePage.getBackgroundColor();

            expect([darkThemeColor, lightThemeColor]).toContain(newBgColor);

            await themePage.elements.helpNavItem.click();

            const helpBgColor = await themePage.getBackgroundColor();

            expect(helpBgColor).toBe(newBgColor);
        }
    })

pmmTest('PMM- T2127 Verify interface theme combobox value in sync with background color',
    async ({ page, themePage }) => {

        await themePage.elements.accountNavItem.click();
        await page.waitForLoadState('domcontentloaded');

        for (let i = 0; i < 2; i++) {
            await themePage.elements.changeThemeButton.click();

            const buttonText = await themePage.elements.changeThemeButton.innerText();
            const expected = buttonText === 'Change to Light Theme' ? 'Dark' : 'Light';

            await expect(themePage.getThemeCombobox()).toHaveValue(expected);
        }
    })
