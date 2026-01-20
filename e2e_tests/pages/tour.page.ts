import { Page, Locator } from '@playwright/test';
import { NavigationInterface } from '../interfaces/navigation';

export default class TourPage implements NavigationInterface {
  public readonly buttons: {
    startTour: Locator;
    nextTip: Locator;
    previousTip: Locator;
    endTour: Locator;
    close: Locator;
  };

  public readonly elements: {
    stepTitle: Locator;
  };

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
    for (let i = 0; i < stepsToMove; i++) {
      await this.buttons.nextTip.click();
    }
  }

  public async getStepTitle(): Promise<string> {
    return await this.elements.stepTitle.innerText();
  }
}
