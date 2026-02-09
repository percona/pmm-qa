import { Locator } from '@playwright/test';
import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest';

export default class ThemePage extends BasePage {
  builders = {};
  buttons = {
    accountNavItem: this.page.getByTestId('navitem-account'),
    changeThemeButton: this.page.getByTestId('navitem-theme-toggle'),
    helpNavItem: this.page.getByTestId('navitem-help'),
  };
  elements = {};
  inputs = {};
  messages = {};

  getBackgroundColor = (): Promise<string> =>
    pmmTest.step('Get background color', async () =>
      this.page.locator('body').evaluate((el) => window.getComputedStyle(el).backgroundColor),
    );

  getThemeCombobox = (): Locator => this.grafanaIframe().getByRole('combobox', { name: 'Interface theme' });
}
