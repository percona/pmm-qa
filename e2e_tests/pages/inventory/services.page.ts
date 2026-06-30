import BasePage from '../base.page';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  builders = {
    monitoringByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="2"]//div`),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};
}
