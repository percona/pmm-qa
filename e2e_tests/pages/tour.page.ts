import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class TourPage extends BasePage {
  readonly alertingTips: { highlighted: string; navItem: string; text: string; title: string }[] = [
    {
      highlighted: 'navitem-alerts-rules-list-item',
      navItem: 'alerts.alertRules',
      text: 'Alert rules specify the conditions for firing alerts.',
      title: 'Alert rules',
    },
    {
      highlighted: 'navitem-alerts-status-list-item',
      navItem: 'alerts.alertStatus',
      text: 'every alert that is currently firing',
      title: 'Status',
    },
    {
      highlighted: 'navitem-alerts-templates-list-item',
      navItem: 'alerts.perconaAlertTemplates',
      text: 'Templates help you create complex alert rules effortlessly.',
      title: 'Templates',
    },
    {
      highlighted: 'navitem-alerts-silences-list-item',
      navItem: 'alerts.silences',
      text: 'shown on the Status page',
      title: 'Silences',
    },
    {
      highlighted: 'navitem-alerts-groups-list-item',
      navItem: 'alerts.alertGroups',
      text: 'Alert groups show grouped alerts.',
      title: 'Alert groups',
    },
    {
      highlighted: 'navitem-alerts-settings-list-item',
      navItem: 'alerts.alertSettings',
      text: 'Use this to configure Alertmanagers in raw JSON format.',
      title: 'Alert settings',
    },
    {
      highlighted: 'navitem-alerts-contact-points-list-item',
      navItem: 'alerts.contactPoints',
      text: 'Define how your contacts are notified when an alert fires.',
      title: 'Contact points',
    },
    {
      highlighted: 'navitem-alerts-policies-list-item',
      navItem: 'alerts.notificationPolicies',
      text: 'Set where, when, and how the alerts get routed.',
      title: 'Notification policies',
    },
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
