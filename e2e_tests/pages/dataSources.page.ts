import BasePage from '@pages/base.page';

/** Grafana's "Add data source" list and the settings form a picked plugin opens. */
export default class DataSourcesPage extends BasePage {
  url = 'graph/connections/datasources/new';
  builders = {
    pluginCard: (pluginName: string) =>
      this.grafanaIframe().getByRole('button', { name: `Add new data source ${pluginName}` }),
  };
  buttons = {
    saveAndTest: this.grafanaIframe().getByTestId(
      'data-testid Data source settings page Save and Test button',
    ),
  };
  elements = {
    testResult: this.grafanaIframe().getByTestId('data-testid Data source settings page Alert'),
  };
  inputs = {
    database: this.grafanaIframe().getByPlaceholder('Database', { exact: true }),
    host: this.grafanaIframe().getByPlaceholder('localhost:5432'),
    name: this.grafanaIframe().getByTestId('data-testid Data source settings page name input field'),
    password: this.grafanaIframe().getByPlaceholder('Password', { exact: true }),
    user: this.grafanaIframe().getByPlaceholder('Username', { exact: true }),
  };
  messages = {};
}
