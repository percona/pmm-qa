import BasePage from '@pages/base.page';

export default class ServerAdminSettingsPage extends BasePage {
  url = 'graph/admin/settings';
  grafanaCallsHomeSettings = [
    { key: 'reporting_enabled', section: 'analytics', value: 'false' },
    { key: 'check_for_plugin_updates', section: 'analytics', value: 'false' },
    { key: 'check_for_updates', section: 'analytics', value: 'false' },
    { key: 'enabled', section: 'analytics', value: 'false' },
    { key: 'feedback_links_enabled', section: 'analytics', value: 'false' },
    { key: 'news_feed_enabled', section: 'news', value: 'false' },
    { key: 'enabled', section: 'reporting', value: 'false' },
    { key: 'disable_gravatar', section: 'security', value: 'true' },
  ];
  builders = {
    settingValue: (section: string, key: string) =>
      this.grafanaIframe().locator(
        `//tr[td[1][normalize-space()="${key}"]][preceding-sibling::tr[td[1]/span][1]/td[1]/span[normalize-space()="${section}"]]/td[2]`,
      ),
  };
  buttons = {};
  elements = {
    databaseType: this.grafanaIframe().locator(
      '//tr[td[1]/span[normalize-space()="database"]]/following-sibling::tr[td[1][normalize-space()="type"]][1]/td[2]',
    ),
    settingsTitle: this.grafanaIframe().getByRole('heading', { exact: true, name: 'Settings' }),
  };
  inputs = {};
  messages = {};
}
