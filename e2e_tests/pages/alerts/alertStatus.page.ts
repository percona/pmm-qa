import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  url = 'pmm-ui/graph/alerting/alerts';
  builders = {
    firingAlert: (alertName: string) =>
      this.grafanaIframe().locator(
        `//tr[.//a[normalize-space(text())="${alertName}"]]//td[position()=2]//span[contains(text(), "active")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
