import BasePage from '@pages/base.page';

/** Grafana's "Add data source" list and the settings form a picked plugin opens. */
export default class DataSourcesPage extends BasePage {
  url = 'graph/connections/datasources/new';
  builders = {
    exploreDataSourceName: (dataSourceName: string) =>
      this.grafanaIframe().getByText(dataSourceName, { exact: true }).first(),
    pluginCard: (pluginName: string) =>
      this.grafanaIframe().getByRole('button', { name: `Add new data source ${pluginName}` }),
  };
  buttons = {
    // The settings page's own action: navigates to Explore with this data source preselected.
    exploreData: this.grafanaIframe().getByRole('link', { name: 'Explore data' }),
    saveAndTest: this.grafanaIframe().getByTestId(
      'data-testid Data source settings page Save and Test button',
    ),
  };
  elements = {
    // Explore-only control, so it doubles as proof the iframe actually navigated there.
    exploreRunQuery: this.grafanaIframe().getByRole('button', { name: 'Run query' }),
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
