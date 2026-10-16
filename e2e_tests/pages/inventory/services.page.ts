import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { tableDataRows } from '@helpers/tableLocators';

export default class ServicesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/services';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    monitoringStatusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('monitoring-status-link'),
    serviceRow: (serviceName: string) =>
      this.elements.serviceRows.filter({ has: this.page.getByText(serviceName, { exact: true }) }),
    statusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('status-chip'),
  };
  buttons = {
    addService: this.page.getByTestId('add-service-button'),
    delete: this.page.getByTestId('delete-services-button'),
  };
  elements = {
    serviceRows: this.page.locator(tableDataRows),
  };
  inputs = {};
  messages = {
    deleteConfirmation: this.page.getByTestId('inventory-delete-modal-message'),
  };
}
