import BasePage from '@pages/base.page';

export default class ScheduledBackupsPage extends BasePage {
  url = 'graph/backup/scheduled';
  urls = {
    locations: 'graph/backup/locations',
  };
  builders = {};
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
}
