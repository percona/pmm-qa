import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  builders = {
    monitoringByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    rowsPerPageOption: (rowsPerPage: string) =>
      this.grafanaIframe().getByRole('option', { exact: true, name: rowsPerPage }),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe()
        .getByRole('row', { name: serviceName })
        .getByTitle(/^STATUS_/),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
  };
  elements = {
    rowsPerPageDropdown: this.grafanaIframe().getByTestId('pagination').locator('div[class*="-singleValue"]'),
  };
  inputs = {};
  messages = {};

  waitForServiceMonitoring = async (
    serviceName: string,
    expectedStatus: 'OK' | 'Failed',
    timeout = Timeouts.THIRTY_SECONDS,
  ) => {
    for (let i = 0; i <= timeout; i += 1_000) {
      const actualStatus = await this.builders.monitoringByServiceName(serviceName).textContent();

      if (actualStatus === expectedStatus) return;
      if (i == timeout) {
        throw new Error(
          `Status was not: ${expectedStatus} for service ${serviceName} in timeout: ${timeout}, last status was ${actualStatus}`,
        );
      }

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait between getting the service status
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
    }
  };

  waitForServiceStatus = async (
    serviceName: string,
    expectedStatus: 'Up' | 'Down',
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

      // eslint-disable-next-line playwright/no-wait-for-timeout -- Wait between getting the service status
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
    }
  };
}
