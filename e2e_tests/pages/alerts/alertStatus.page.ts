import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  url = 'graph/alerting/groups';
  builders = {
    firingAlert: (alertName: string) => this.page.getByText(alertName, { exact: true }),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
