import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2096 - Verify theme change functionality via change to dark/light theme button @new-navigation',
  async ({ page, themePage }) => {
    const darkThemeColor = 'rgb(58, 65, 81)';
    const lightThemeColor = 'rgb(240, 241, 244)';

    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Theme change validation', async () => {
        await themePage.buttons.accountNavItem.click();
        await page.waitForTimeout(2_000);

        const previousBgColor = await themePage.getBackgroundColor();
        const previousThemeButtonText = await themePage.buttons.changeThemeButton.innerText();

        await themePage.buttons.changeThemeButton.click();
        await expect.poll(() => themePage.getBackgroundColor()).not.toBe(previousBgColor);
        await expect
          .poll(() => themePage.buttons.changeThemeButton.innerText())
          .not.toBe(previousThemeButtonText);

        const newBgColor = await themePage.getBackgroundColor();

        expect([darkThemeColor, lightThemeColor]).toContain(newBgColor);
        await themePage.buttons.helpNavItem.click();
        expect(await themePage.getBackgroundColor()).toBe(newBgColor);
      });
    }
  },
);

pmmTest(
  'PMM-T2127 Verify interface theme combobox value in sync with background color @new-navigation',
  async ({ themePage }) => {
    await themePage.buttons.accountNavItem.click();

    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Toggle theme and verify combobox value syncs', async () => {
        await themePage.buttons.changeThemeButton.click();

        const buttonText = await themePage.buttons.changeThemeButton.innerText();
        const expectedComboboxValue = buttonText === 'Switch to light mode' ? 'Dark' : 'Light';

        await expect(themePage.getThemeCombobox()).toHaveValue(expectedComboboxValue, { timeout: 10_000 });
      });
    }
  },
);
