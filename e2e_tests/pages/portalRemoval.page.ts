import { Locator } from '@playwright/test';
import BasePage from './base.page';

export default class PortalRemovalPage extends BasePage {
  builders = {};
  buttons = {};
  elements = {
    pageNotFound: this.page.getByText(/page not found|404/i),
  };
  inputs = {};
  messages = {};

  advisorsText = (isIframe = false): Locator =>
    (isIframe ? this.grafanaIframe() : this.page).getByText('Want more Advisors?');

  connectToPlatform = (isIframe = false): Locator =>
    (isIframe ? this.grafanaIframe() : this.page).getByRole('button', {
      name: 'Connect to Percona Platform',
    });

  perconaPlatformTab = (isIframe = false): Locator =>
    (isIframe ? this.grafanaIframe() : this.page).getByTestId('data-testid Tab Percona Platform');
}
