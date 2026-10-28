import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  readonly pagination = new InventoryPagination(this.grafanaIframe());
  builders = {
    addressByServiceName: (serviceName: string) =>
      this.grafanaIframe().getByRole('row', { name: serviceName }).getByRole('cell').nth(5),
    hideServiceDetails: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('hide-row-details'),
    monitoringStatusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    selectServiceCheckbox: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('select-row').locator('span'),
    serviceDetailsLabel: (label: string) =>
      this.grafanaIframe()
        .getByTestId('details-row-content')
        .getByRole('listitem')
        .filter({ hasText: label }),
    serviceNameCell: (serviceName: string) => this.grafanaIframe().locator(`td[title="${serviceName}"]`),
    serviceRow: (serviceName: string) =>
      this.elements.serviceRows.filter({ has: this.page.getByTitle(serviceName, { exact: true }) }),
    serviceRowActions: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('dropdown-menu-toggle'),
    showServiceDetails: (serviceName: string) =>
      this.builders.serviceRow(serviceName).getByTestId('show-row-details'),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe()
        .getByRole('row', { name: serviceName })
        .getByTitle(/^STATUS_/),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
    confirmDelete: this.grafanaIframe().getByTestId('delete-services-confirm'),
    confirmLabelsChange: this.grafanaIframe().getByRole('button', { name: 'Confirm and save changes' }),
    delete: this.grafanaIframe().getByRole('button', { exact: true, name: 'Delete' }),
    editService: this.grafanaIframe().getByTestId('dropdown-button').filter({ hasText: 'Edit' }),
    forceDelete: this.grafanaIframe().getByRole('dialog').getByText('Force mode', { exact: true }),
    saveChanges: this.grafanaIframe().getByTestId('edit-instance-submit'),
  };
  elements = {
    serviceNames: this.grafanaIframe().locator('tbody').getByTestId('table-tbody-tr').locator('xpath=td[3]'),
    serviceRows: this.grafanaIframe().locator('tbody').getByTestId('table-tbody-tr'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {
    cluster: this.grafanaIframe().getByTestId('cluster-text-input'),
    environment: this.grafanaIframe().getByTestId('environment-text-input'),
    replicationSet: this.grafanaIframe().getByTestId('replication_set-text-input'),
  };
  messages = {
    deleteConfirmation: this.grafanaIframe().getByTestId('delete-services-description'),
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
    await this.builders.showServiceDetails(serviceName).click({ timeout: Timeouts.THIRTY_SECONDS });

    for (const label of labels) {
      await expect(this.builders.serviceDetailsLabel(label)).toBeVisible({
        timeout: Timeouts.TWENTY_SECONDS,
      });
    }

    await this.builders.hideServiceDetails(serviceName).click();
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
