import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  readonly pagination = new InventoryPagination(this.grafanaIframe());
  builders = {
    monitoringStatusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe()
        .getByRole('row', { name: serviceName })
        .getByTitle(/^STATUS_/),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
    delete: this.grafanaIframe().getByRole('button', { exact: true, name: 'Delete' }),
  };
  elements = {};
  inputs = {};
  messages = {
    deleteConfirmation: this.grafanaIframe().getByTestId('delete-services-description'),
  };
}
