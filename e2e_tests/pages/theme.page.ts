
import { Page, Locator } from '@playwright/test';

export default class ThemePage {
    readonly page: Page;

    readonly accountNavItem: Locator;
    readonly changeThemeButton: Locator
    readonly helpNavItem: Locator
    // readonly combobox: Locator
    // readonly comboboxLight: Locator
    // readonly comboboxDark: Locator

    constructor(page: Page) {
        this.page = page;

        this.accountNavItem = page.getByTestId('navitem-account');
        this.changeThemeButton = page.getByTestId('navitem-theme-toggle');
        this.helpNavItem = page.getByTestId('navitem-help');
        // this.combobox = page.getByRole('combobox', { name: 'Interface theme' });
        // this.comboboxLight = page.getByRole('option', { name: 'Light' });
        // this.comboboxDark = page.getByRole('option', { name: 'Dark' });
    }

    async getBackgroundColor() {
        return this.page.locator('body').evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });
    }

    async clickAccountNavItem() {
        await this.accountNavItem.click();
    }

    async clickChangeThemeButton() {
        await this.changeThemeButton.click();
    }

    async clickHelpNavItem() {
        await this.helpNavItem.click();
    }

    async getThemeButtonText() {
        return this.changeThemeButton.innerText();
    }
}