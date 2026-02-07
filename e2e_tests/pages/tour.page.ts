import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class TourPage extends BasePage {
  readonly titles = [
    'Percona Dashboards',
    'Query Analytics (QAN) dashboard',
    'Explore',
    'Alerts & Percona Templates',
    'Advisors',
    'Management: Inventory & Backups',
    'Configurations',
    'Help Center',
  ];
  builders = {};
  buttons = {
    close: this.page.getByTestId('tour-close-button'),
    endTour: this.page.getByTestId('tour-end-tour-button'),
    nextTip: this.page.getByTestId('tour-next-step-button'),
    previousTip: this.page.getByTestId('tour-previous-step-button'),
    startTour: this.page.getByTestId('tips-card-start-product-tour-button'),
  };
  elements = {
    stepTitle: this.page.getByTestId('tour-step-title'),
  };
  inputs = {};
  messages = {};

  getStepTitle = async (): Promise<string> =>
    pmmTest.step('Get current step title text', async () => await this.elements.stepTitle.innerText());

  navigateForward = async (stepsToMove: number): Promise<void> => {
    await pmmTest.step('Navigate forward', async () => {
      for (let i = 0; i < stepsToMove; i++) await this.buttons.nextTip.click();
    });
  };
}
