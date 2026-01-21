import { Page } from '@playwright/test';
import { IPageObject } from '../interfaces/pageObject';
import pmmTest from '@fixtures/pmmTest';

export default class TourPage implements IPageObject {
  public readonly buttons;
  public readonly elements;

  public readonly titles = [
    'Percona Dashboards',
    'Query Analytics (QAN) dashboard',
    'Explore',
    'Alerts & Percona Templates',
    'Advisors',
    'Management: Inventory & Backups',
    'Configurations',
    'Help Center'
  ];

  constructor(public readonly page: Page) {
    this.buttons = {
      startTour: this.page.getByTestId('tips-card-start-product-tour-button'),
      nextTip: this.page.getByTestId('tour-next-step-button'),
      previousTip: this.page.getByTestId('tour-previous-step-button'),
      endTour: this.page.getByTestId('tour-end-tour-button'),
      close: this.page.getByTestId('tour-close-button'),
    };

    this.elements = {
      stepTitle: this.page.getByTestId('tour-step-title'),
    };
  }

  public async navigateForward(stepsToMove: number): Promise<void> {
    await pmmTest.step('Navigate forward', async () => {
      for (let i = 0; i < stepsToMove; i++) {
        await this.buttons.nextTip.click();
      }
    });
  }

  public async getStepTitle(): Promise<string> {
    return pmmTest.step('Get current step title text', async () => {
      return await this.elements.stepTitle.innerText();
    });
  }
}
