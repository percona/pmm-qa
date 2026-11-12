import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class ScheduledBackupsPage extends BasePage {
  url = 'graph/backup/scheduled';
  builders = {
    lastBackup: (name: string) =>
      this.grafanaIframe().getByRole('row').filter({ hasText: name }).getByTestId('detailed-date'),
  };
  buttons = {
    createScheduledBackup: this.grafanaIframe().getByTestId('scheduled-backup-add-button'),
    settingsLink: this.grafanaIframe().getByTestId('settings-link'),
  };
  elements = {
    emptyBlock: this.grafanaIframe().getByTestId('empty-block'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {};
  messages = {};

  open = async () => {
    await this.page.goto(this.url);
    await expect(this.buttons.createScheduledBackup).toContainText('Create scheduled backup', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };
}
