import { Page, Locator } from '@playwright/test';

export default class TourPage {
  public static readonly titles = [
    'Percona Dashboards',
    'Query Analytics (QAN) dashboard',
    'Explore',
    'Alerts & Percona Templates',
    'Percona Advisors',
    'Management: Inventory & Backups',
    'Configurations',
    'Help Center'
  ];

  constructor(public page: Page) { }

  public elements = {
    startTourButton: () => this.page.getByTestId('tips-card-start-product-tour-button'),
    nextTip: () => this.page.getByTestId('tour-next-step-button'),
    previousTip: () => this.page.getByTestId('tour-previous-step-button'),
    endTourButton: () => this.page.getByTestId('tour-end-tour-button'),
    closeButton: () => this.page.getByTestId('tour-close-button'),
    stepTitle: () => this.page.getByTestId('tour-step-title'),
  };

  public navigateForward = async (stepsToMove: number): Promise<void> => {
    for (let i = 0; i < stepsToMove; i++) {
      await this.elements.nextTip().click();
    }
  }

  public getStepTitle = async (): Promise<string> => {
    return (await this.elements.stepTitle().innerText());
  }
}
