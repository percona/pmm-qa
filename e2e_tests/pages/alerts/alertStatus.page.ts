import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  url = 'pmm-ui/alerting/status';
  builders = {
    firingAlert: (alertName: string) =>
      this.page.locator(
        `//td[text()="${alertName}"]/parent::tr//td[position()="2"]//span[contains(text(), "Firing")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
