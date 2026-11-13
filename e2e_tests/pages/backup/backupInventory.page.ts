import BasePage from '@pages/base.page';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { expect, Locator } from '@playwright/test';
import { BackupStatus, RestoreStatus } from '@interfaces/backup';

export default class BackupInventoryPage extends BasePage {
  url = 'graph/backup/inventory';
  urls = {
    restoreHistory: 'graph/backup/restore',
  };
  builders = {
    actionsToggle: (name: string) => this.builders.artifactRow(name).getByTestId('dropdown-menu-toggle'),
    artifactName: (name: string) => this.builders.artifactRow(name).getByRole('cell').nth(1),
    artifactRow: (name: string) => this.grafanaIframe().getByRole('row').filter({ hasText: name }),
    createdDate: (name: string) => this.builders.artifactRow(name).getByTestId('detailed-date'),
    deleteButton: (name: string) =>
      this.builders.artifactRow(name).getByTestId('delete-backup-artifact-button'),
    logsButton: (name: string) =>
      this.builders.artifactRow(name).getByRole('button', { exact: true, name: 'Logs' }),
    option: (name: string) =>
      this.grafanaIframe()
        .getByRole('option')
        .filter({ has: this.page.getByText(name, { exact: true }) }),
    pendingStatus: (name: string) => this.builders.artifactRow(name).getByTestId('statusPending'),
    restoreButton: (name: string) =>
      this.builders.artifactRow(name).getByTestId('restore-backup-artifact-button'),
    restoreFinished: (name: string) => this.builders.artifactRow(name).getByTestId('restore-finished'),
    restoreStarted: (name: string) => this.builders.artifactRow(name).getByTestId('restore-started'),
    retryMode: (mode: 'Auto' | 'Manual') =>
      this.grafanaIframe().getByTestId('retry-mode-selector').getByText(mode, { exact: true }),
    showDetails: (name: string) => this.builders.artifactRow(name).getByTestId('show-row-details'),
    status: (name: string, status: BackupStatus | RestoreStatus) =>
      this.builders.artifactRow(name).getByTitle(status, { exact: true }),
    statusMessage: (name: string) => this.builders.artifactRow(name).getByTestId('statusMsg'),
    successIcon: (name: string) => this.builders.artifactRow(name).getByTestId('success-icon'),
    targetService: (name: string) => this.builders.artifactRow(name).getByRole('cell').nth(5),
  };
  buttons = {
    advancedSettings: this.grafanaIframe().getByTestId('add-backup-advanced-settings'),
    closeAlert: this.grafanaIframe().getByRole('button', { exact: true, name: 'Close alert' }),
    confirmDelete: this.grafanaIframe().getByTestId('confirm-delete-modal-button'),
    copyToClipboard: this.grafanaIframe()
      .getByTestId('modal-content')
      .getByRole('button', { name: 'Copy to clipboard' }),
    createBackup: this.grafanaIframe().getByTestId('backup-add-button'),
    forceDelete: this.grafanaIframe().getByTestId('force-checkbox-input'),
    restore: this.grafanaIframe().getByTestId('restore-button'),
  };
  elements = {
    backupModalError: this.grafanaIframe().getByTestId('backup-modal-error'),
    deleteMessage: this.grafanaIframe().getByTestId('modal-content').getByRole('heading', { level: 4 }),
    forceDeleteLabel: this.grafanaIframe().getByTestId('force-field-label'),
    fullBackupName: this.grafanaIframe().getByTestId('backup-artifact-details-name'),
    loadedTable: this.grafanaIframe()
      .getByTestId('table-tbody')
      .or(this.grafanaIframe().getByTestId('table-no-data').getByRole('heading')),
    logs: this.grafanaIframe().getByTestId('modal-content').locator('pre'),
    modalHeader: this.grafanaIframe().getByTestId('modal-header'),
    noData: this.grafanaIframe().getByTestId('table-no-data'),
  };
  inputs = {
    backupName: this.grafanaIframe().getByTestId('backupName-text-input'),
    location: this.grafanaIframe().getByTestId('location-select-input'),
    retryInterval: this.grafanaIframe().getByTestId('retryInterval-number-input'),
    retryTimes: this.grafanaIframe().getByTestId('retryTimes-number-input'),
    service: this.grafanaIframe().getByTestId('service-select-input'),
    vendor: this.grafanaIframe().getByTestId('vendor-text-input'),
  };
  messages = {
    backupNameError: this.grafanaIframe().getByTestId('backupName-field-error-message'),
    popUp: this.grafanaIframe()
      .getByRole('status')
      .or(this.grafanaIframe().getByRole('alert'))
      .and(this.grafanaIframe().locator(':not([aria-label="Loading"])')),
  };

  open = async (url = this.url) => {
    await this.page.goto(url);
    await expect(this.elements.loadedTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  openDeleteModal = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.deleteButton(name).click();
  };

  openRestoreModal = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.restoreButton(name).click();
  };

  selectFromDropdown = async (select: Locator, name: string) => {
    await select.click();
    await this.builders.option(name).click();
  };

  startRestore = async (name: string) => {
    await this.openRestoreModal(name);

    const [response] = await Promise.all([
      this.page.waitForResponse((response) => response.url().includes(apiEndpoints.backups.startRestore)),
      this.buttons.restore.click(),
    ]);

    return ((await response.json()) as { restore_id: string }).restore_id;
  };

  submitBackup = async () => {
    await Promise.all([
      this.page.waitForResponse((response) => response.url().includes(apiEndpoints.backups.startBackup)),
      this.buttons.createBackup.click(),
    ]);
  };

  verifyBackupStatus = async (name: string, status: BackupStatus) => {
    await this.page.goto(this.url);
    await expect(this.builders.status(name, status)).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
  };

  verifyRestoreStatus = async (name: string, status: RestoreStatus) => {
    await this.page.goto(this.urls.restoreHistory);
    await expect(this.builders.statusMessage(name)).not.toHaveCount(0, { timeout: Timeouts.FIVE_MINUTES });
    await expect(this.builders.pendingStatus(name)).toBeHidden({ timeout: Timeouts.FIVE_MINUTES });
    await expect(this.builders.status(name, status)).toHaveCount(
      await this.builders.statusMessage(name).count(),
      {
        timeout: Timeouts.FIVE_MINUTES,
      },
    );
  };
}
