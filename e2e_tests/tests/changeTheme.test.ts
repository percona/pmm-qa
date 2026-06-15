import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await grafanaHelper.authorize();
  await page.goto('pmm-ui/help');
});

pmmTest(
  'PMM-T2096 - Verify theme change functionality via change to dark/light theme button @new-navigation',
  async ({ leftNavigation, page }) => {
    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Theme change validation', async () => {
        await leftNavigation.selectMenuItem('accounts');
        await expect(leftNavigation.getThemeCombobox()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(leftNavigation.menuItemLocator('accounts.changeTheme')).toBeVisible();

        const previousBgColor = await leftNavigation.getBackgroundColor();
        const previousThemeButtonText = await leftNavigation
          .menuItemLocator('accounts.changeTheme')
          .innerText();

        await leftNavigation.menuItemLocator('accounts.changeTheme').click();
        await expect
          .poll(() => leftNavigation.menuItemLocator('accounts.changeTheme').innerText(), {
            timeout: Timeouts.THIRTY_SECONDS,
          })
          .not.toBe(previousThemeButtonText);
        await expect
          .poll(() => leftNavigation.getBackgroundColor(), { timeout: Timeouts.THIRTY_SECONDS })
          .not.toBe(previousBgColor);

        const newBgColor = await leftNavigation.getBackgroundColor();

        await leftNavigation.menuItemLocator('help').click();
        await expect(page).toHaveURL(/\/pmm-ui\/help$/, { timeout: Timeouts.THIRTY_SECONDS });
        await expect
          .poll(() => leftNavigation.getBackgroundColor(), { timeout: Timeouts.THIRTY_SECONDS })
          .toBe(newBgColor);
      });
    }
  },
);

pmmTest(
  'PMM-T2127 Verify interface theme combobox value in sync with background color @new-navigation',
  async ({ leftNavigation }) => {
    await expect(leftNavigation.menuItemLocator('accounts')).toBeVisible();
    await leftNavigation.selectMenuItem('accounts');
    await expect(leftNavigation.menuItemLocator('accounts.changeTheme')).toBeVisible();
    await expect(leftNavigation.getThemeCombobox()).toBeVisible({ timeout: Timeouts.ONE_MINUTE });

    for (let i = 0; i < 2; i++) {
      await pmmTest.step('Toggle theme and verify combobox value syncs', async () => {
        const previousThemeButtonText = await leftNavigation
          .menuItemLocator('accounts.changeTheme')
          .innerText();

        await leftNavigation.menuItemLocator('accounts.changeTheme').click();
        await expect
          .poll(() => leftNavigation.menuItemLocator('accounts.changeTheme').innerText(), {
            timeout: Timeouts.THIRTY_SECONDS,
          })
          .not.toBe(previousThemeButtonText);

        const buttonText = await leftNavigation.menuItemLocator('accounts.changeTheme').innerText();
        const expectedComboboxValue = buttonText === 'Switch to light mode' ? 'Dark' : 'Light';

        await expect
          .poll(() => leftNavigation.getThemeCombobox().inputValue(), {
            timeout: Timeouts.THIRTY_SECONDS,
          })
          .toBe(expectedComboboxValue);
      });
    }
  },
);
