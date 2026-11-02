import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { Timeouts } from '@helpers/timeouts';
import { tableDataRows } from '@helpers/tableLocators';

export default class ServicesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/services';
  readonly exportFileName = /^inventory_services_export_\d{8}_\d{6}\.csv$/;
  // Rows per page reach the table through the URL; the dropdown offers no size below 10
  readonly pageSizeParam = 'services.pageSize';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    addressByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).locator('td:nth-child(7)'),
    // A cluster row's expand button keeps the name "Expand" either way, only its tooltip changes
    expandRowButton: (name: string) => this.builders.serviceRow(name).getByRole('button', { name: 'Expand' }),
    monitoringStatusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('monitoring-status-link'),
    selectServiceCheckbox: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('checkbox', { name: 'Toggle select row' }),
    serviceDetailsLabel: (label: string) => this.elements.serviceDetails.getByText(label, { exact: true }),
    // Material React Table names the button "Expand" whether the row is expanded or not
    serviceDetailsToggle: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('button', { exact: true, name: 'Expand' }),
    serviceNameCell: (serviceName: string) =>
      this.builders.serviceRow(serviceName).locator('td:nth-child(4)'),
    serviceRow: (serviceName: string) =>
      this.elements.serviceRows.filter({
        has: this.page.locator('td:nth-child(4)').getByText(serviceName, { exact: true }),
      }),
    serviceRowActions: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('button', { name: 'Row Actions' }),
    statusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('status-chip'),
  };
  buttons = {
    addService: this.page.getByTestId('add-service-button'),
    confirmDelete: this.page.getByTestId('inventory-delete-modal-confirm'),
    confirmLabelsChange: this.page.getByTestId('confirm-changes-modal-confirm'),
    delete: this.page.getByTestId('delete-services-button'),
    editService: this.page.getByRole('menuitem', { name: 'Edit' }),
    export: this.page.getByTestId('export-services-button'),
    forceDelete: this.page.getByRole('checkbox', { name: 'Force mode' }),
    organizeByClusters: this.page.getByTestId('organize-by-clusters-switch'),
    saveChanges: this.page.getByTestId('edit-service-submit'),
    showFilters: this.page.getByRole('button', { name: 'Show/Hide filters' }),
  };
  elements = {
    serviceDetails: this.page.getByTestId('service-details'),
    serviceNames: this.page.locator(tableDataRows).locator('td:nth-child(4)'),
    serviceRows: this.page.locator(tableDataRows),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    cluster: this.page.getByRole('textbox', { name: 'Cluster' }),
    environment: this.page.getByRole('textbox', { name: 'Environment' }),
    replicationSet: this.page.getByRole('textbox', { name: 'Replication set' }),
    serviceNameFilter: this.page.getByPlaceholder('Filter by Service Name', { exact: true }),
  };
  messages = {
    deleteConfirmation: this.page.getByTestId('inventory-delete-modal-message'),
  };

  deleteService = async (serviceName: string, force: boolean) => {
    await this.builders.selectServiceCheckbox(serviceName).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.buttons.delete.click();

    if (force) await this.buttons.forceDelete.check();

    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('/v1/inventory/services/') && response.request().method() === 'DELETE',
      ),
      this.buttons.confirmDelete.click(),
    ]);
  };

  editServiceLabels = async (
    serviceName: string,
    labels: { cluster: string; environment: string; replicationSet: string },
  ) => {
    await this.builders.serviceRowActions(serviceName).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.buttons.editService.click();
    await this.inputs.environment.fill(labels.environment, { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.replicationSet.fill(labels.replicationSet);
    await this.inputs.cluster.fill(labels.cluster);
    await this.buttons.saveChanges.click();
    await this.buttons.confirmLabelsChange.click();
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

  getServiceNames = async () => (await this.elements.serviceNames.allTextContents()).toSorted();

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

    await this.builders.selectServiceCheckbox(serviceName).check();
  };

  verifyEditedServiceLabels = async (
    serviceName: string,
    labels: { cluster: string; environment: string; replicationSet: string },
  ) =>
    this.verifyServiceLabels(serviceName, [
      `environment=${labels.environment}`,
      `cluster=${labels.cluster}`,
      `replication_set=${labels.replicationSet}`,
    ]);

  verifyServiceLabels = async (serviceName: string, labels: string[]) => {
    await this.builders.serviceDetailsToggle(serviceName).click({ timeout: Timeouts.THIRTY_SECONDS });

    for (const label of labels) {
      await expect(this.builders.serviceDetailsLabel(label)).toBeVisible({
        timeout: Timeouts.TWENTY_SECONDS,
      });
    }

    await this.builders.serviceDetailsToggle(serviceName).click();
  };

  verifyServiceListedOnce = async (serviceName: string): Promise<void> => {
    await this.page.goto(this.url);
    await expect(this.builders.serviceNameCell(serviceName)).toHaveCount(1, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };

  verifyServiceMonitoringStatusOk = async (serviceName: string) => {
    await expect(async () => {
      await this.page.reload();
      await expect(
        this.builders.monitoringStatusByServiceName(serviceName),
        `'${serviceName}' is expected to have 'OK' monitoring status`,
      ).toHaveText('OK', { timeout: Timeouts.FIVE_SECONDS });
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
  };
}
