import BasePage from '@pages/base.page';

/** Grafana's "Add data source" list and the settings form a picked plugin opens. */
export default class DataSourcesPage extends BasePage {
  url = 'graph/connections/datasources/new';
  exploreUrl = 'graph/explore';
  builders = {
    exploreDataSourceName: (dataSourceName: string) =>
      this.grafanaIframe().getByText(dataSourceName, { exact: true }).first(),
    pluginCard: (pluginName: string) =>
      this.grafanaIframe().getByRole('button', { name: `Add new data source ${pluginName}` }),
  };
  buttons = {
    // The success alert renders a second link with the same accessible name, so
    // exclude it to keep this a single element.
    exploreData: this.grafanaIframe()
      .getByRole('link', { name: 'Explore data' })
      .filter({ hasNotText: 'Explore view' }),
    exploreGiveFeedback: this.grafanaIframe().getByText('Give feedback'),
    saveAndTest: this.grafanaIframe().getByTestId(
      'data-testid Data source settings page Save and Test button',
    ),
  };
  elements = {
    exploreQueryEditorModeToggle: this.grafanaIframe().getByTestId('QueryEditorModeToggle'),
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
