import { Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

/**
 * Page object for the public Percona downloads website.
 * Selectors are intentionally text/role based since this is an external site
 * whose markup is not controlled by the PMM team and may change over time.
 */
export default class DownloadsPage extends BasePage {
  url = 'https://www.percona.com/downloads';
  builders = {};
  buttons = {
    pmmProduct: this.page.getByRole('link', { name: 'Percona Monitoring and Management' }),
  };
  elements = {
    osPackages: this.page.locator('a[href$=".rpm"], a[href$=".deb"], a[href$=".tar.gz"]'),
    versionSelect: this.page.locator('select').first(),
  };
  inputs = {};
  messages = {};

  getAvailablePackages = async (): Promise<string[]> =>
    await pmmTest.step('Read available OS packages', async () => {
      const hrefs = await this.elements.osPackages.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLAnchorElement).href),
      );

      return hrefs.filter(Boolean);
    });

  getAvailableVersions = async (): Promise<string[]> =>
    await pmmTest.step('Read available versions', async () => {
      const options = this.elements.versionSelect.locator('option');

      return (await options.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
    });

  open = async (): Promise<void> =>
    await pmmTest.step('Open Percona downloads page', async () => {
      await this.page.goto(this.url);
    });

  selectPmmProduct = async (): Promise<void> =>
    await pmmTest.step('Select PMM product', async () => {
      await this.buttons.pmmProduct.first().click({ timeout: Timeouts.THIRTY_SECONDS });
      await this.page.waitForLoadState();
    });

  versionLocator = (version: string): Locator => this.page.getByText(version, { exact: false }).first();
}
