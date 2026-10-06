import BasePage from '@pages/base.page';

export default class ScheduledBackupsPage extends BasePage {
  url = 'graph/backup/scheduled';
  builders = {};
  buttons = {
    createScheduledBackup: this.grafanaIframe().getByTestId('scheduled-backup-add-button'),
    settingsLink: this.grafanaIframe().getByTestId('settings-link'),
  };
  elements = {
    emptyBlock: this.grafanaIframe().getByTestId('empty-block'),
  };
  inputs = {};
  messages = {};
}
