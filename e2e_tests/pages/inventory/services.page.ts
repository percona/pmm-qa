import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { tableDataRows } from '@helpers/tableLocators';

export default class ServicesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/services';
  readonly exportFileName = /^inventory_services_export_\d{8}_\d{6}\.csv$/;
  // Rows per page reach the table through the URL; the dropdown offers no size below 10
  readonly pageSizeParam = 'services.pageSize';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    // A cluster row's expand button keeps the name "Expand" either way, only its tooltip changes
    expandRowButton: (name: string) => this.builders.serviceRow(name).getByRole('button', { name: 'Expand' }),
    monitoringStatusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('monitoring-status-link'),
    selectRowCheckbox: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('checkbox', { name: 'Toggle select row' }),
    serviceRow: (serviceName: string) =>
      this.elements.serviceRows.filter({ has: this.page.getByText(serviceName, { exact: true }) }),
    statusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('status-chip'),
  };
  buttons = {
    addService: this.page.getByTestId('add-service-button'),
    delete: this.page.getByTestId('delete-services-button'),
    export: this.page.getByTestId('export-services-button'),
    organizeByClusters: this.page.getByTestId('organize-by-clusters-switch'),
    showFilters: this.page.getByRole('button', { name: 'Show/Hide filters' }),
  };
  elements = {
    serviceRows: this.page.locator(tableDataRows),
  };
  inputs = {
    serviceNameFilter: this.page.getByPlaceholder('Filter by Service Name', { exact: true }),
  };
  messages = {
    deleteConfirmation: this.page.getByTestId('inventory-delete-modal-message'),
  };

  // Each exported row keyed by its CSV header
  exportServices = async (): Promise<Record<string, string>[]> => {
    const downloadPromise = this.page.waitForEvent('download');

    await this.buttons.export.click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(this.exportFileName);

    const [header, ...rows] = (await readFile(await download.path(), 'utf8'))
      .split(/\r?\n/)
      .filter(Boolean)
      // export-to-csv quotes strings but not numbers, so split on the commas outside quotes
      .map((line) =>
        line
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((cell) => cell.replace(/^"(.*)"$/, '$1').replaceAll('""', '"')),
      );

    return rows.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index]])));
  };

  filterByServiceName = async (text: string) => {
    if (!(await this.inputs.serviceNameFilter.isVisible())) await this.buttons.showFilters.click();

    await this.inputs.serviceNameFilter.fill(text);
  };

  // Pages forward from the first page until the row shows, since the table keeps a selection across pages
  selectServiceRow = async (serviceName: string) => {
    if (await this.pagination.previousPageButton.isEnabled()) await this.pagination.firstPageButton.click();

    await expect(this.pagination.previousPageButton).toBeDisabled();

    while (!(await this.builders.serviceRow(serviceName).isVisible())) {
      const interval = await this.pagination.itemsInterval.textContent();

      await expect(this.pagination.nextPageButton, `${serviceName} should be on a later page`).toBeEnabled();
      await this.pagination.nextPageButton.click();
      await expect(this.pagination.itemsInterval).not.toHaveText(interval ?? '');
    }

    await this.builders.selectRowCheckbox(serviceName).check();
  };
}
