import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  // PMM 3.8.1 renders fired alerts on the Grafana-based "Fired alerts" page (inside the
  // #grafana-iframe), not on the pmm-ui/alerting/status page introduced in later versions.
  url = 'graph/alerting/alerts';
  builders = {
    firingAlert: (alertName: string) =>
      this.grafanaIframe().locator(
        `//td[contains(., "${alertName}")]/parent::tr//td[position()="2"]//span[contains(text(), "active")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
