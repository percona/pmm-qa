import { Page, Download, Locator } from '@playwright/test';
import { IPageObject } from '../interfaces/pageObject';

export default class HelpPage implements IPageObject {
  public readonly buttons;

  constructor(public readonly page: Page) {
    this.buttons = {
      viewDocs: this.page.getByRole('link', { name: 'View docs' }),
      contactSupport: this.page.getByRole('link', { name: 'Contact Support' }),
      viewForum: this.page.getByRole('link', { name: 'View forum' }),
      manageDatasets: this.page.getByRole('link', { name: 'Manage datasets' }),
      exportLogs: this.page.getByRole('link', { name: 'Export logs' }),
      startPmmTour: this.page.getByTestId('tips-card-start-product-tour-button'),
      shareYourThoughts: this.page.getByRole('link', { name: 'Share your thoughts' }),
      nextTip: this.page.getByTestId('tour-next-step-button'),
    };
  }

  public async clickExternalLink(button: Locator): Promise<{ href: string | null; newTab: Page }> {
    const href = await button.getAttribute('href');
    const popup = this.page.waitForEvent('popup');
    await button.click();
    const newTab = await popup;
    return { href, newTab };
  }

  public async exportLogs(): Promise<Download> {
    const download = this.page.waitForEvent('download');
    await this.buttons.exportLogs.click();
    return download;
  }
}
