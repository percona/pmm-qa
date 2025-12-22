import { Page } from '@playwright/test';

export default class ThemePage {
    constructor(public page: Page) { }

    public get elements() {
        return {
            accountNavItem: this.page.locator('//*[@data-testid="navitem-account"]'),
            changeThemeButton: this.page.locator('//*[@data-testid="navitem-theme-toggle"]'),
            helpNavItem: this.page.locator('//*[@data-testid="navitem-help"]'),
        };
    }

    getBackgroundColor = async () => {
        return this.page.locator('body').evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });
    };

    getThemeCombobox() {
        return this.page.locator('#grafana-iframe').contentFrame().getByRole('combobox', { name: 'Interface theme' });
    }
}
