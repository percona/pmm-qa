import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  // PMM 3.7.0 has no native "pmm-ui/alerting/status" page (that route was added in
  // a later release and returns "Not found" here). On 3.7.0 alerting lives in the
  // embedded Grafana UI; firing alert instances are listed on the "Fired alerts"
  // page inside the Grafana iframe.
  url = 'pmm-ui/graph/alerting/alerts';
  builders = {
    // The rule name is rendered as a link in the first column and the State
    // column ("Triggered by rule", "State", ...) holds the alert instance state,
    // whose DOM text is the lowercase "active" (CSS capitalises it to "Active").
    firingAlert: (alertName: string) =>
      this.grafanaIframe().locator(
        `//td[a[contains(text(), "${alertName}")]]/parent::tr//td[position()="2"]//span[contains(translate(text(), "ACTIVE", "active"), "active")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
