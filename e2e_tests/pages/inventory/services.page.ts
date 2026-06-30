import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';

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

  waitForServiceStatus = async (
    serviceName: string,
    expectedStatus: string,
    timeout = Timeouts.THIRTY_SECONDS,
  ) => {
    for (let i = 0; i <= timeout; i += 1_000) {
      const actualStatus = await this.builders.statusByServiceName(serviceName).textContent();

      if (actualStatus === expectedStatus) return;
      if (i == timeout) {
        throw new Error(
          `Status was not: ${expectedStatus} for service ${serviceName} in timeout: ${timeout}, last status was ${actualStatus}`,
        );
      }
    }
  };
}
