import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class TourPage extends BasePage {
  readonly alertingTips: { menuItem: string; text?: string; title: string }[] = [
    { menuItem: 'navitem-alerts-rules-list-item', title: 'Alert rules' },
    {
      menuItem: 'navitem-alerts-status-list-item',
      text: 'every alert that is currently firing',
      title: 'Status',
    },
    { menuItem: 'navitem-alerts-templates-list-item', title: 'Templates' },
    { menuItem: 'navitem-alerts-silences-list-item', text: 'shown on the Status page', title: 'Silences' },
    { menuItem: 'navitem-alerts-groups-list-item', title: 'Alert groups' },
    { menuItem: 'navitem-alerts-settings-list-item', title: 'Alert settings' },
    { menuItem: 'navitem-alerts-contact-points-list-item', title: 'Contact points' },
    { menuItem: 'navitem-alerts-policies-list-item', title: 'Notification policies' },
  ];
  readonly removedAlertingTip = 'Fired alerts';
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
  builders = {
    alertingMenuItem: (testId: string) => this.page.getByTestId(testId),
    counter: (step: number, total: number) =>
      this.page.getByTestId('tour-counter').getByText(`Tip ${step} of ${total}`, { exact: true }),
  };
  buttons = {
    close: this.page.getByTestId('tour-close-button'),
    endTour: this.page.getByTestId('tour-end-tour-button'),
    nextTip: this.page.getByTestId('tour-next-step-button'),
    previousTip: this.page.getByTestId('tour-previous-step-button'),
    startTour: this.page.getByTestId('tips-card-start-product-tour-button'),
  };
  elements = {
    popover: this.page.locator('.reactour__popover'),
    stepBody: this.page.getByTestId('tour-step-body'),
    stepTitle: this.page.getByTestId('tour-step-title'),
  };
  inputs = {};
  messages = {};

  // The menu item under the centre of the mask's cut-out, by its -list-item test id. Hidden rows of
  // collapsed nav groups keep non-zero boxes, so the item is hit-tested rather than matched by box.
  getHighlightedMenuItem = async (): Promise<string | null> =>
    await this.page.evaluate(() => {
      const cutOut = document.querySelectorAll('.reactour__mask mask rect')[1];

      if (!cutOut) return null;

      const style = window.getComputedStyle(cutOut);
      const [x, y, width, height] = [style.x, style.y, style.width, style.height].map((v) =>
        Number.parseFloat(v),
      );

      if (!width || !height) return null;

      return (
        document
          .elementsFromPoint(x + width / 2, y + height / 2)
          .map((element) => element.closest('[data-testid$="-list-item"]')?.getAttribute('data-testid'))
          .find(Boolean) ?? null
      );
    });

  getStepTitle = async (): Promise<string> =>
    pmmTest.step('Get current step title text', async () => await this.elements.stepTitle.innerText());

  navigateForward = async (stepsToMove: number): Promise<void> => {
    await pmmTest.step('Navigate forward', async () => {
      for (let i = 0; i < stepsToMove; i++) await this.buttons.nextTip.click();
    });
  };
}
