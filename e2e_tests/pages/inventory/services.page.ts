import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  readonly pagination = new InventoryPagination(this.grafanaIframe());
  builders = {
    monitoringStatusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    serviceNameCell: (serviceName: string) => this.grafanaIframe().locator(`td[title="${serviceName}"]`),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe()
        .getByRole('row', { name: serviceName })
        .getByTitle(/^STATUS_/),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
    delete: this.grafanaIframe().getByRole('button', { exact: true, name: 'Delete' }),
  };
  elements = {
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {};
  messages = {
    deleteConfirmation: this.grafanaIframe().getByTestId('delete-services-description'),
  };

  verifyServiceListedOnce = async (serviceName: string): Promise<void> => {
    await this.page.goto(this.url);
    await expect(this.builders.serviceNameCell(serviceName)).toHaveCount(1, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };
}
