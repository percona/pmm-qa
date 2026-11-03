import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { Timeouts } from '@helpers/timeouts';
import { tableDataRows } from '@helpers/tableLocators';
import { expect } from '@playwright/test';

export default class ServicesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/services';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    addressByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).locator('td:nth-child(7)'),
    monitoringStatusByServiceName: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('monitoring-status-link'),
    selectServiceCheckbox: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('checkbox', { name: 'Toggle select row' }),
    serviceDetailsLabel: (label: string) => this.elements.serviceDetails.getByText(label, { exact: true }),
    // Material React Table names the button "Expand" whether the row is expanded or not
    serviceDetailsToggle: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByRole('button', { exact: true, name: 'Expand' }),
    serviceNameCell: (serviceName: string) =>
      this.elements.serviceRows.getByRole('cell', { exact: true, name: serviceName }),
    serviceRow: (serviceName: string) =>
      this.elements.serviceRows.filter({ has: this.page.getByText(serviceName, { exact: true }) }),
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
    forceDelete: this.page.getByRole('checkbox', { name: 'Force mode' }),
    saveChanges: this.page.getByTestId('edit-service-submit'),
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

  getServiceNames = async () => (await this.elements.serviceNames.allTextContents()).toSorted();

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
