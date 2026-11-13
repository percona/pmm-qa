import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class ScheduledBackupsPage extends BasePage {
  url = 'graph/backup/scheduled';
  builders = {
    actionsToggle: (name: string) => this.builders.row(name).getByTestId('dropdown-menu-toggle'),
    cell: (name: string, column: 'frequency' | 'location' | 'retention' | 'type' | 'vendor') =>
      this.builders
        .row(name)
        .getByRole('cell')
        .nth(['name', 'vendor', 'frequency', 'retention', 'type', 'location'].indexOf(column)),
    copyButton: (name: string) => this.builders.row(name).getByTestId('copy-scheduled-backup-button'),
    deleteButton: (name: string) => this.builders.row(name).getByTestId('delete-scheduled-backpup-button'),
    detail: (field: 'cron' | 'data-model' | 'name', value: string) =>
      this.grafanaIframe().getByTestId(`scheduled-backup-details-${field}`).getByText(value, { exact: true }),
    editButton: (name: string) => this.builders.row(name).getByTestId('edit-scheduled-backpup-button'),
    lastBackup: (name: string) =>
      this.grafanaIframe().getByRole('row').filter({ hasText: name }).getByTestId('detailed-date'),
    mode: (mode: 'Full' | 'PITR') => this.grafanaIframe().getByText(mode, { exact: true }),
    row: (name: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name }) }),
    scheduleField: (field: 'day' | 'month' | 'period' | 'weekDay') =>
      this.grafanaIframe().getByTestId(`${field}-field-label`).locator('xpath=../following-sibling::div[1]'),
    showDetails: (name: string) => this.builders.row(name).getByTestId('show-row-details'),
    toggle: (name: string) => this.builders.row(name).getByTestId('toggle-scheduled-backpup'),
  };
  buttons = {
    cancelDelete: this.grafanaIframe().getByTestId('cancel-delete-modal-button'),
    confirmDelete: this.grafanaIframe().getByTestId('confirm-delete-modal-button'),
    createScheduledBackup: this.grafanaIframe().getByTestId('scheduled-backup-add-button'),
    onDemand: this.grafanaIframe().getByRole('button', { exact: true, name: 'On Demand' }),
    settingsLink: this.grafanaIframe().getByTestId('settings-link'),
  };
  elements = {
    deleteMessage: this.grafanaIframe().getByTestId('modal-content').getByRole('heading', { level: 4 }),
    detailsDescription: this.grafanaIframe()
      .getByTestId('scheduled-backup-details-description')
      .locator('pre'),
    emptyBlock: this.grafanaIframe().getByTestId('empty-block'),
    modalContent: this.grafanaIframe().getByTestId('modal-content'),
    noData: this.grafanaIframe().getByTestId('table-no-data'),
    pageHeader: this.grafanaIframe().getByRole('heading', { level: 1 }),
    retentionError: this.grafanaIframe().getByTestId('retention-field-error-message'),
    scheduleHint: this.grafanaIframe()
      .getByTestId('advanced-backup-fields')
      .getByRole('heading', { level: 6 }),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {
    description: this.grafanaIframe().getByTestId('description-textarea-input'),
    folder: this.grafanaIframe().getByTestId('folder-text-input'),
    retention: this.grafanaIframe().getByTestId('retention-number-input'),
  };
  messages = {};

  copySchedule = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.copyButton(name).click();
  };

  open = async () => {
    await this.page.goto(this.url);
    await expect(this.buttons.createScheduledBackup).toContainText('Create scheduled backup', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };

  openDeleteModal = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.deleteButton(name).click();
  };

  openEditForm = async (name: string) => {
    await this.builders.actionsToggle(name).click();
    await this.builders.editButton(name).click();
  };

  openScheduleForm = async () => {
    await this.buttons.createScheduledBackup.click();
    await expect(this.elements.pageHeader).toHaveText('Create Scheduled backup', {
      timeout: Timeouts.TWENTY_SECONDS,
    });
  };

  verifyScheduleValues = async (schedule: {
    cronExpression: string;
    dataModel: string;
    description: string;
    frequency: string;
    location: string;
    name: string;
    retention: number;
    type: string;
    vendor: string;
  }) => {
    await expect(this.builders.cell(schedule.name, 'vendor')).toHaveText(schedule.vendor);
    await expect(this.builders.cell(schedule.name, 'frequency')).toHaveText(schedule.frequency);
    await expect(this.builders.cell(schedule.name, 'retention')).toHaveText(`${schedule.retention} backups`);
    await expect(this.builders.cell(schedule.name, 'type')).toHaveText(schedule.type);
    await expect(this.builders.cell(schedule.name, 'location')).toHaveText(schedule.location);
    await this.builders.showDetails(schedule.name).click();
    await expect(this.builders.detail('name', schedule.name)).toBeVisible();
    await expect(this.elements.detailsDescription).toHaveText(schedule.description);
    await expect(this.builders.detail('data-model', schedule.dataModel)).toBeVisible();
    await expect(this.builders.detail('cron', schedule.cronExpression)).toBeVisible();
  };
}
