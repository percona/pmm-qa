import { expect } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

const PMM_PRODUCT_NAME = 'Percona Monitoring and Management';

/**
 * Page object for the public Percona downloads website.
 * Selectors are intentionally text/role based since this is an external site
 * whose markup is not controlled by the PMM team and may change over time.
 */
export default class DownloadsPage extends BasePage {
  url = 'https://www.percona.com/downloads';
  builders = {};
  buttons = {
    pmmInstall: this.page
      .locator('.product-card')
      .filter({
        has: this.page.getByRole('heading', { exact: true, level: 3, name: PMM_PRODUCT_NAME }),
      })
      .getByText('Install', { exact: true }),
  };
  elements = {
    downloadPanel: this.page
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { level: 2, name: PMM_PRODUCT_NAME }) }),
    osPackages: this.page.locator('a[href$=".rpm"], a[href$=".deb"], a[href$=".tar.gz"]'),
    versionSelect: this.page.getByRole('combobox', { name: 'Version' }),
  };
  inputs = {};
  messages = {};

  getAvailablePackages = async (): Promise<string[]> =>
    await pmmTest.step('Read available OS packages', async () => {
      const packageLinks = this.elements.downloadPanel.locator(
        'a[href$=".rpm"], a[href$=".deb"], a[href$=".tar.gz"]',
      );
      const hrefs = await packageLinks.evaluateAll((nodes) =>
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
      await this.page.goto(this.url, { timeout: Timeouts.ONE_MINUTE, waitUntil: 'domcontentloaded' });

      await this.page
        .getByRole('dialog', { name: 'Cookie Consent Banner' })
        .getByRole('button', { name: 'Accept All' })
        .click({ timeout: Timeouts.TEN_SECONDS })
        .catch(() => undefined);
    });

  selectPmmProduct = async (): Promise<void> =>
    await pmmTest.step('Select PMM product', async () => {
      await this.buttons.pmmInstall.click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(this.elements.versionSelect).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });
}
