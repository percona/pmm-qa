import { Locator, Page } from '@playwright/test';

const grafanaIframe = '#grafana-iframe';

export default class ThemePage {
  constructor(public page: Page) { }

  public elements() {
    return {
      accountNavItem: () => this.page.getByTestId('navitem-account'),
      changeThemeButton: () => this.page.getByTestId('navitem-theme-toggle'),
      helpNavItem: () => this.page.getByTestId('navitem-help'),
    };
  }

  public openAccountMenu = async (): Promise<void> => {
    await this.elements().accountNavItem().click();
  }

  public toggleTheme = async (): Promise<void> => {
    await this.elements().changeThemeButton().click();
  }

  public openHelp = async (): Promise<void> => {
    await this.elements().helpNavItem().click();
  }

  public getBackgroundColor = async (): Promise<string> => {
    return this.page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }

  public getThemeCombobox(): Locator {
    return this.page.frameLocator(grafanaIframe).getByRole('combobox', { name: 'Interface theme' });
  }
}
