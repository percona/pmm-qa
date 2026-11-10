import { Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class TourPage extends BasePage {
  readonly alertingTips: { navItem: string; text: string; title: string }[] = [
    {
      navItem: 'alerts.alertRules',
      text: 'Alert rules specify the conditions for firing alerts.',
      title: 'Alert rules',
    },
    {
      navItem: 'alerts.alertStatus',
      text: 'every alert that is currently firing',
      title: 'Status',
    },
    {
      navItem: 'alerts.perconaAlertTemplates',
      text: 'Templates help you create complex alert rules effortlessly.',
      title: 'Templates',
    },
    {
      navItem: 'alerts.silences',
      text: 'shown on the Status page',
      title: 'Silences',
    },
    {
      navItem: 'alerts.alertGroups',
      text: 'Alert groups show grouped alerts.',
      title: 'Alert groups',
    },
    {
      navItem: 'alerts.alertSettings',
      text: 'Use this to configure Alertmanagers in raw JSON format.',
      title: 'Alert settings',
    },
    {
      navItem: 'alerts.contactPoints',
      text: 'Define how your contacts are notified when an alert fires.',
      title: 'Contact points',
    },
    {
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
    // reactour's mask: the first rect covers the page, the second is the cut-out over the target
    highlight: this.page.locator('.reactour__mask mask rect').nth(1),
    stepBody: this.page.getByTestId('tour-step-body'),
    stepTitle: this.page.getByTestId('tour-step-title'),
  };
  inputs = {};
  messages = {};

  getStepTitle = async (): Promise<string> =>
    pmmTest.step('Get current step title text', async () => await this.elements.stepTitle.innerText());

  isHighlighted = async (target: Locator): Promise<boolean> => {
    const [[x, y, width, height], box] = await Promise.all([
      this.elements.highlight.evaluate((rect) => {
        const style = window.getComputedStyle(rect);

        return [style.x, style.y, style.width, style.height].map((value) => Number.parseFloat(value));
      }),
      target.boundingBox(),
    ]);
    const centre = { x: x + width / 2, y: y + height / 2 };

    return (
      !!box &&
      width > 0 &&
      centre.x >= box.x &&
      centre.x <= box.x + box.width &&
      centre.y >= box.y &&
      centre.y <= box.y + box.height
    );
  };

  navigateForward = async (stepsToMove: number): Promise<void> => {
    await pmmTest.step('Navigate forward', async () => {
      for (let i = 0; i < stepsToMove; i++) await this.buttons.nextTip.click();
    });
  };
}
