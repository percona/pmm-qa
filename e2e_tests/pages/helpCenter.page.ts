import { Page, Download, Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class HelpPage extends BasePage {
  elements = {};
  buttons = {
    viewDocs: this.page.getByRole('link', { name: 'View docs' }),
    contactSupport: this.page.getByRole('link', { name: 'Contact Support' }),
    viewForum: this.page.getByRole('link', { name: 'View forum' }),
    manageDatasets: this.page.getByRole('link', { name: 'Manage datasets' }),
    exportLogs: this.page.getByRole('link', { name: 'Export logs' }),
    startPmmTour: this.page.getByTestId('tips-card-start-product-tour-button'),
    shareYourThoughts: this.page.getByRole('link', { name: 'Share your thoughts' }),
    nextTip: this.page.getByTestId('tour-next-step-button'),
  };
  inputs = {};
  messages = {};
  builders = {};

  async clickExternalLink(button: Locator): Promise<{ href: string | null; newTab: Page }> {
    return await pmmTest.step('Click external link', async () => {
      const href = await button.getAttribute('href');
      const popup = this.page.waitForEvent('popup');

      await button.click();

      const newTab = await popup;

      return { href, newTab };
    });
  }

  async exportLogs(): Promise<Download> {
    return await pmmTest.step('Export logs', async () => {
      const download = this.page.waitForEvent('download');

      await this.buttons.exportLogs.click();

      return download;
    });
  }
}
