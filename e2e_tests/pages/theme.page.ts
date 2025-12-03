
import { Page, Locator } from '@playwright/test';

export default class ThemePage {
    readonly page: Page;

    readonly accountNavItem: Locator;
    readonly changeThemeButton: Locator
    readonly helpNavItem: Locator

    constructor(page: Page) {
        this.page = page;

        this.accountNavItem = page.getByTestId('navitem-account');
        this.changeThemeButton = page.getByTestId('navitem-theme-toggle');
        this.helpNavItem = page.getByTestId('navitem-help');
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