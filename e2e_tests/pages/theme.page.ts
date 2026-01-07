import { Locator, Page } from '@playwright/test';

const grafanaIframe = '#grafana-iframe';

export default class ThemePage {
    constructor(public page: Page) { }

    public get elements() {
        return {
            accountNavItem: this.page.getByTestId('navitem-account'),
            changeThemeButton: this.page.getByTestId('navitem-theme-toggle'),
            helpNavItem: this.page.getByTestId('navitem-help'),
        };
    }

    public async openAccountMenu(): Promise<void> {
        await this.elements.accountNavItem.click();
    }

    public async toggleTheme(): Promise<void> {
        await this.elements.changeThemeButton.click();
    }

    public async openHelp(): Promise<void> {
        await this.elements.helpNavItem.click();
    }

    public async getBackgroundColor(): Promise<string> {
        return this.page.locator('body').evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });
    }

    public getThemeCombobox(): Locator {
        return this.page.frameLocator(grafanaIframe).getByRole('combobox', { name: 'Interface theme' });
    }
}
