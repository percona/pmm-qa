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

  public elements() {
    return {
      startTourButton: () => this.page.getByTestId('tips-card-start-product-tour-button'),
      nextTip: () => this.page.getByTestId('tour-next-step-button'),
      previousTip: () => this.page.getByTestId('tour-previous-step-button'),
      endTourButton: () => this.page.getByTestId('tour-end-tour-button'),
      closeButton: () => this.page.getByTestId('tour-close-button'),
      stepTitle: () => this.page.getByTestId('tour-step-title'),
    };
  }

  public startTour = async (): Promise<void> => {
    await this.elements().startTourButton().click();
  }

  public nextStep = async (): Promise<void> => {
    await this.elements().nextTip().click();
  }

  public previousStep = async (): Promise<void> => {
    await this.elements().previousTip().click();
  }

  public endTour = async (): Promise<void> => {
    await this.elements().endTourButton().click();
  }

  public closeTour = async (): Promise<void> => {
    await this.elements().closeButton().click();
  }

  public navigateForward = async (stepsToMove: number): Promise<void> => {
    for (let i = 0; i < stepsToMove; i++) {
      await this.nextStep();
    }
  }

  public getStepTitle = async (): Promise<string> => {
    return (await this.elements().stepTitle().innerText());
  }
}
