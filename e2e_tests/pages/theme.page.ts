import { Page, Locator } from '@playwright/test';

export default class ThemePage {
    constructor(private page: Page) { }

    private elements = {
        accountNavItem: '//*[@data-testid="navitem-account"]',
        changeThemeButton: '//*[@data-testid="navitem-theme-toggle"]',
        helpNavItem: '//*[@data-testid="navitem-help"]',
    };

    getBackgroundColor = async () => {
        return this.page.locator('body').evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });
    };

    getLocator(locator: keyof ThemePage['elements']) {
        return this.page.locator(this.elements[locator]);
    }
}