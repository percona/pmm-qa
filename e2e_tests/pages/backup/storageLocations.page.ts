import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { s3StorageConnection } from '@testdata/backupLocations';
import { expect } from '@playwright/test';

type LocationInput = 'accessKey' | 'bucketName' | 'endpoint' | 'name' | 'secretKey';

export default class StorageLocationsPage extends BasePage {
  url = 'graph/backup/locations';
  requiredFields: LocationInput[] = ['name', 'endpoint', 'bucketName', 'accessKey', 'secretKey'];
  builders = {
    actionsToggle: (name: string) => this.builders.row(name).getByTestId('dropdown-menu-toggle'),
    cell: (name: string, text: string) =>
      this.builders.row(name).getByRole('cell', { exact: true, name: text }),
    deleteButton: (name: string) => this.builders.row(name).getByTestId('delete-storage-location-button'),
    detailsBucket: (bucket: string) =>
      this.grafanaIframe().getByTestId('storage-location-bucket').getByText(bucket, { exact: true }),
    editButton: (name: string) => this.builders.row(name).getByTestId('edit-storage-location-button'),
    fieldError: (field: LocationInput) => this.grafanaIframe().getByTestId(`${field}-field-error-message`),
    fieldLabel: (field: LocationInput | 'description' | 'type') =>
      this.grafanaIframe().getByTestId(`${field}-field-label`),
    hideDetails: (name: string) => this.builders.row(name).getByTestId('hide-row-details'),
    row: (name: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name }) }),
    showDetails: (name: string) => this.builders.row(name).getByTestId('show-row-details'),
    textInput: (field: LocationInput) => this.grafanaIframe().getByTestId(`${field}-text-input`),
    typeRadio: (type: 'Local Client' | 'S3') =>
      this.grafanaIframe().getByRole('radio', { exact: true, name: type }),
  };
  buttons = {
    addLocation: this.grafanaIframe().getByTestId('storage-location-add-button'),
    cancel: this.grafanaIframe().getByTestId('storage-location-cancel-button'),
    cancelDelete: this.grafanaIframe().getByTestId('cancel-delete-modal-button'),
    closeAlert: this.grafanaIframe().getByLabel('Close alert'),
    closeModal: this.grafanaIframe().getByTestId('modal-close-button'),
    confirmDelete: this.grafanaIframe().getByTestId('confirm-delete-modal-button'),
    forceDelete: this.grafanaIframe().getByTestId('force-checkbox-input'),
    openAddLocationModal: this.grafanaIframe().getByTestId('storage-location-add-modal-button'),
    showSecret: this.grafanaIframe().getByTestId('secret-key').getByTestId('icon-eye'),
    testLocation: this.grafanaIframe().getByTestId('storage-location-test-button'),
  };
  elements = {
    columnHeaders: this.grafanaIframe().getByRole('columnheader'),
    deleteMessage: this.grafanaIframe().getByTestId('modal-content').getByRole('heading', { level: 4 }),
    deleteWarning: this.grafanaIframe().getByTestId('warning-block'),
    detailsAccessKey: this.grafanaIframe().getByTestId('access-key'),
    detailsDescription: this.grafanaIframe().getByTestId('storage-location-description').locator('pre'),
    detailsSecretKey: this.grafanaIframe().getByTestId('small-secret-holder'),
    detailsWrapper: this.grafanaIframe().getByTestId('storage-location-wrapper'),
    modalHeader: this.grafanaIframe().getByTestId('modal-header'),
    noData: this.grafanaIframe().getByTestId('table-no-data'),
  };
  inputs = {
    description: this.grafanaIframe().getByTestId('description-textarea-input'),
  };
  messages = {
    popUp: this.grafanaIframe()
      .getByRole('status')
      .or(this.grafanaIframe().getByRole('alert'))
      .and(this.grafanaIframe().locator(':not([aria-label="Loading"])')),
  };

  fillS3Location = async (name: string, connection = s3StorageConnection) => {
    await this.builders.textInput('name').fill(name);
    await this.builders.textInput('endpoint').fill(connection.endpoint);
    await this.builders.textInput('bucketName').fill(connection.bucket_name);
    await this.builders.textInput('accessKey').fill(connection.access_key);
    await this.builders.textInput('secretKey').fill(connection.secret_key);
  };

  open = async () => {
    await this.page.goto(this.url);
    await expect(this.buttons.openAddLocationModal).toContainText('Add', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };

  openAddLocationModal = async () => {
    await this.buttons.openAddLocationModal.click();
    await expect(this.builders.fieldLabel('name')).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.elements.modalHeader).toHaveText('Add Storage Location');
    await expect(this.buttons.closeModal).toBeVisible();
  };

  openDeleteModal = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.deleteButton(name).click();
  };

  openEditModal = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.editButton(name).click();
  };

  touchRequiredFields = async () => {
    for (const field of this.requiredFields) await this.builders.textInput(field).click();

    await this.inputs.description.click();
  };

  verifyLocationFields = async (name: string, description: string) => {
    await expect(this.builders.textInput('name')).toHaveValue(name, { timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.inputs.description).toHaveValue(description);
    await expect(this.builders.textInput('endpoint')).toHaveValue(s3StorageConnection.endpoint);
    await expect(this.builders.textInput('bucketName')).toHaveValue(s3StorageConnection.bucket_name);
    await expect(this.builders.textInput('accessKey')).toHaveValue(s3StorageConnection.access_key);
    await expect(this.builders.textInput('secretKey')).toHaveAttribute('type', 'password');
    await expect(this.builders.textInput('secretKey')).toHaveValue(s3StorageConnection.secret_key);
  };
}
