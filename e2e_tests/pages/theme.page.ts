import { Locator } from '@playwright/test';
import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest';

export default class ThemePage extends BasePage {
  elements = {};
  buttons = {
    accountNavItem: this.page.getByTestId('navitem-account'),
    changeThemeButton: this.page.getByTestId('navitem-theme-toggle'),
    helpNavItem: this.page.getByTestId('navitem-help'),
  };
  inputs = {};
  messages = {};
  builders = {};

  async getBackgroundColor(): Promise<string> {
    return pmmTest.step('Get background color', async () => {
      return this.page.locator('body').evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });
    });
  }

  getThemeCombobox(): Locator {
    return this.grafanaIframe().getByRole('combobox', { name: 'Interface theme' });
  }
}
