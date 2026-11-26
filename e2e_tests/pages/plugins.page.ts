import BasePage from '@pages/base.page';

export default class PluginsPage extends BasePage {
  url = 'graph/plugins?filterBy=installed';
  clickHouse = 'ClickHouse';
  builders = {
    pluginCard: (name: string) =>
      this.grafanaIframe()
        .getByTestId('plugin-list')
        .getByRole('link')
        .filter({ has: this.grafanaIframe().getByRole('heading', { exact: true, name }) }),
  };
  buttons = {
    versionHistoryTab: this.grafanaIframe().getByTestId('data-testid Tab Version history'),
  };
  elements = {
    installedFilter: this.grafanaIframe().getByRole('radio', { name: 'Installed' }),
    installedVersion: this.grafanaIframe().getByRole('cell', { name: /^\S+ \(installed version\)$/ }),
    versions: this.grafanaIframe().getByRole('cell', { name: /^\d+\.\d+\.\d+/ }),
  };
  inputs = {};
  messages = {};
}
