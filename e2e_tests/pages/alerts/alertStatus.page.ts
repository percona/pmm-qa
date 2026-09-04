import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  // PMM 3.7.1 has no native "Fired alerts" page (pmm-ui/alerting/status renders
  // an empty "Not found" state). Fired alerts are shown by the Grafana alerting
  // app, embedded in the Grafana iframe, where the instance state reads "Active".
  url = 'pmm-ui/graph/alerting/alerts';
  builders = {
    firingAlert: (alertName: string) =>
      this.grafanaIframe().locator(
        `//tr[td[1][contains(normalize-space(.), "${alertName}")]]/td[2][contains(translate(normalize-space(.), 'ACTIVE', 'active'), "active")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
