import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

export default class PortalRemoval extends BasePage {
  advancedSettingsUrl = '/pmm-ui/settings/advanced-settings';
  advisorsUrl = '/advisors';
  removedUrls = ['/entitlements', '/tickets', '/settings/percona-platform'];
  settingsUrl = '/pmm-ui/settings';
  builders = {};
  buttons = {
    applyChanges: this.page.getByTestId('advanced-button'),
    getFromBrowser: this.page.getByRole('button', { name: 'Get from browser' }),
  };
  elements = {
    advisorsText: this.grafanaIframe().getByText('Want more Advisors?'),
    connectToPlatform: this.grafanaIframe().getByRole('button', {
      name: 'Connect to Percona Platform',
    }),
    pageNotFound: this.page.getByText(/page not found|404/i),
    perconaPlatformTab: this.page.getByRole('tab', { name: /Percona Platform/i }),
  };
  inputs = {};
  messages = {};

  openAdvancedSettings = async (): Promise<void> => {
    await pmmTest.step('Open Advanced Settings page and apply required actions', async () => {
      await this.page.goto(this.advancedSettingsUrl);
      await this.buttons.getFromBrowser.click();
      await expect(this.buttons.applyChanges).toBeEnabled();
      await this.buttons.applyChanges.click();
    });
  };
}
