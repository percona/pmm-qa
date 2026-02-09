import { Page, Download, Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class HelpPage extends BasePage {
  builders = {};
  buttons = {
    contactSupport: this.page.getByRole('link', { name: 'Contact Support' }),
    exportLogs: this.page.getByRole('link', { name: 'Export logs' }),
    manageDatasets: this.page.getByRole('link', { name: 'Manage datasets' }),
    nextTip: this.page.getByTestId('tour-next-step-button'),
    shareYourThoughts: this.page.getByRole('link', { name: 'Share your thoughts' }),
    startPmmTour: this.page.getByTestId('tips-card-start-product-tour-button'),
    viewDocs: this.page.getByRole('link', { name: 'View docs' }),
    viewForum: this.page.getByRole('link', { name: 'View forum' }),
  };
  elements = {};
  inputs = {};
  messages = {};

  clickExternalLink = async (button: Locator): Promise<{ href: string | null; newTab: Page }> =>
    await pmmTest.step('Click external link', async () => {
      const href = await button.getAttribute('href');
      const popup = this.page.waitForEvent('popup');

      await button.click();

      const newTab = await popup;

      return { href, newTab };
    });

  exportLogs = async (): Promise<Download> =>
    await pmmTest.step('Export logs', async () => {
      const download = this.page.waitForEvent('download');

      await this.buttons.exportLogs.click();

      return download;
    });
}
