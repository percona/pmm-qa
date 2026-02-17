import BasePage from './base.page';
import pmmTest from '@fixtures/pmmTest';

export default class PortalRemoval extends BasePage {
  advancedSettingsUrl = 'pmm-ui/graph/settings/advanced-settings';
  advisorsUrl = '/advisors';
  builders = {};
  buttons = {
    applyChanges: this.grafanaIframe().getByTestId('advanced-button'),
    getAddress: this.grafanaIframe().getByTestId('public-address-button'),
  };
  elements = {
    advisorsText: this.grafanaIframe().getByText('Want more Advisors?'),
    connectToPlatform: this.grafanaIframe().getByRole('button', {
      name: 'Connect to Percona Platform',
    }),
    pageNotFound: this.page.getByText(/page not found|404/i),
    perconaPlatformTab: this.grafanaIframe().getByTestId('data-testid Tab Percona Platform'),
  };
  inputs = {};
  messages = {};
  removedUrls = ['/entitlements', '/tickets', '/settings/percona-platform'];
  settingsUrl = '/graph/settings';

  openAdvancedSettings = async (): Promise<void> => {
    await pmmTest.step('Open Advanced Settings page and apply required actions', async () => {
      await this.page.goto(this.advancedSettingsUrl);
      await this.buttons.getAddress.click();
      await this.buttons.applyChanges.click();
    });
  };
}
