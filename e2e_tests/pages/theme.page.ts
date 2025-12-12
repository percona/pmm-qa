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

    getThemeCombobox() {
        return this.page.locator('#grafana-iframe').contentFrame().getByRole('combobox', { name: 'Interface theme' });
    }

    getLocator(locator: keyof ThemePage['elements']) {
        return this.page.locator(this.elements[locator]);
    }
}
