import { Locator, Page } from '@playwright/test';
import { IPageObject } from '@interfaces/pageObject';
import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest';

export default class ThemePage extends BasePage implements IPageObject {
  public readonly buttons;

  constructor(public readonly page: Page) {
    super(page);
    this.buttons = {
      accountNavItem: this.page.getByTestId('navitem-account'),
      changeThemeButton: this.page.getByTestId('navitem-theme-toggle'),
      helpNavItem: this.page.getByTestId('navitem-help'),
    };
  }

  public async getBackgroundColor(): Promise<string> {
    return pmmTest.step('Get background color', async () => {
      return this.page.locator('body').evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
    });
  }

  public getThemeCombobox(): Locator {
    return this.grafanaIframe().getByRole('combobox', { name: 'Interface theme' });
  }
}
