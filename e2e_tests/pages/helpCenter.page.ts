import { Page, Download, Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class HelpPage extends BasePage {
  url = '/pmm-ui/help';
  readonly cases = [{ updateAvailable: true }, { updateAvailable: false }];
  builders = {};
  buttons = {
    addServiceButton: this.page.getByTestId('welcome-card-add-service'),
    contactSupport: this.page.getByRole('link', { name: 'Contact Support' }),
    dismissButton: this.page.getByTestId('welcome-card-dismiss'),
    exportLogs: this.page.getByRole('link', { name: 'Export logs' }),
    manageDatasets: this.page.getByRole('link', { name: 'Manage datasets' }),
    nextTip: this.page.getByTestId('tour-next-step-button'),
    shareYourThoughts: this.page.getByRole('link', { name: 'Share your thoughts' }),
    startPmmTour: this.page.getByTestId('tips-card-start-product-tour-button'),
    startTourButton: this.page.getByTestId('welcome-card-start-tour'),
    tourCloseButton: this.page.getByTestId('tour-close-button'),
    updates: this.page.getByTestId('update-modal-go-to-updates-button'),
    viewDocs: this.page.getByRole('link', { name: 'View docs' }),
    viewForum: this.page.getByRole('link', { name: 'View forum' }),
  };
  elements = {
    tourPopover: this.page.locator('.reactour__popover'),
    welcomeCard: this.page.getByTestId('welcome-card'),
  };
  inputs = {};
  messages = {};

  clickExternalLink = async (button: Locator): Promise<{ href: string | null; newTab: Page }> =>
    await pmmTest.step('Click external link', async () => {
      const href = await button.getAttribute('href');
      const [newTab] = await Promise.all([this.page.waitForEvent('popup'), button.click()]);

      return { href, newTab };
    });

  exportLogs = async (): Promise<Download> =>
    await pmmTest.step('Export logs', async () => {
      const download = this.page.waitForEvent('download');

      await this.buttons.exportLogs.click();

      return download;
    });
}
