import BasePage from '@pages/base.page';

export default class ServerAdminSettingsPage extends BasePage {
  url = 'graph/admin/settings';
  builders = {};
  buttons = {};
  elements = {
    databaseType: this.grafanaIframe().locator(
      '//tr[td[1]/span[normalize-space()="database"]]/following-sibling::tr[td[1][normalize-space()="type"]][1]/td[2]',
    ),
    settingsTitle: this.grafanaIframe().locator('[class*="title-info-container"]'),
  };
  inputs = {};
  messages = {};
}
