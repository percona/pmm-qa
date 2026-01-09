import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify theme change functionality via change to dark/light theme button @new-navigation',
  async ({ themePage }) => {

    const darkThemeColor = 'rgb(58, 65, 81)';
    const lightThemeColor = 'rgb(240, 241, 244)';

    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Open account menu and check change theme', async () => {
        await themePage.openAccountMenu();
        const previousBgColor = await themePage.getBackgroundColor();
        const previousThemeButtonText = await themePage.elements().changeThemeButton().innerText();
        await themePage.toggleTheme();
        await expect.poll(() => themePage.getBackgroundColor()).not.toBe(previousBgColor);
        await expect.poll(() => themePage.elements().changeThemeButton().innerText()).not.toBe(previousThemeButtonText);
      });

      const newBgColor = await themePage.getBackgroundColor();
      expect([darkThemeColor, lightThemeColor]).toContain(newBgColor);

      await pmmTest.step('Verify theme persists on another page', async () => {
        await themePage.openHelp();
        const helpBgColor = await themePage.getBackgroundColor();
        expect(helpBgColor).toBe(newBgColor);
      });
    }
  }
);

pmmTest('PMM- T2127 Verify interface theme combobox value in sync with background color @new-navigation',
  async ({ themePage }) => {

    await pmmTest.step('Open account menu', async () => {
      await themePage.openAccountMenu();
    });

    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Toggle theme and verify combobox value', async () => {
        await themePage.toggleTheme();

        const buttonText = await themePage.elements().changeThemeButton().innerText();
        const expected = buttonText === 'Change to Light Theme' ? 'Dark' : 'Light';

        await expect(themePage.getThemeCombobox()).toHaveValue(expected);
      });
    }
  }
);
