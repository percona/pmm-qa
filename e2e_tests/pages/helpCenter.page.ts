import { Page, Locator } from '@playwright/test';

export default class HelpPage {
  constructor(public page: Page) { }

  public elements = {
    viewDocsButton: () => this.page.getByRole('link', { name: 'View docs' }),
    contactSupportButton: () => this.page.getByRole('link', { name: 'Contact Support' }),
    viewForumButton: () => this.page.getByRole('link', { name: 'View forum' }),
    manageDatasetsButton: () => this.page.getByRole('link', { name: 'Manage datasets' }),
    exportLogsButton: () => this.page.getByRole('link', { name: 'Export logs' }),
    startPmmTourButton: () => this.page.getByTestId('tips-card-start-product-tour-button'),
    shareYourThoughtsButton: () => this.page.getByRole('link', { name: 'Share your thoughts' }),
    nextTipButton: () => this.page.getByTestId('tour-next-step-button'),
  };



  exportLogs = async (): Promise<any> => {
    const download = this.page.waitForEvent('download');
    await this.elements.exportLogsButton().click();
    return download;
  }

  clickStartPmmTour = async (): Promise<Locator> => {
    await this.elements.startPmmTourButton().click();
    return this.elements.nextTipButton();
  }
}
