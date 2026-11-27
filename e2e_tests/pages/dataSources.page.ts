import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

/** Grafana's "Add data source" list and the settings form a picked plugin opens. */
export default class DataSourcesPage extends BasePage {
  url = 'graph/connections/datasources/new';
  exploreUrl = 'graph/explore';
  listUrl = 'graph/datasources';
  builders = {
    exploreDataSourceCard: (dataSourceName: string) =>
      this.grafanaIframe().getByTestId('data-source-card').filter({ hasText: dataSourceName }),
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
    exploreRunSqlQuery: this.grafanaIframe().getByRole('button', { exact: true, name: 'Run Query' }),
    exploreSqlEditorMode: this.grafanaIframe()
      .getByTestId('data-testid radio-button')
      .filter({ hasText: 'SQL Editor' }),
    saveAndTest: this.grafanaIframe().getByTestId(
      'data-testid Data source settings page Save and Test button',
    ),
  };
  elements = {
    clickHouseDataSource: this.grafanaIframe().getByRole('heading', { exact: true, name: 'ClickHouse' }),
    exploreQueryEditorModeToggle: this.grafanaIframe().getByTestId('QueryEditorModeToggle'),
    exploreResultRows: this.grafanaIframe().getByRole('row'),
    exploreRunQuery: this.grafanaIframe().getByTestId('data-testid RefreshPicker run button'),
    exploreSqlEditorLines: this.grafanaIframe()
      .getByTestId('data-testid Code editor container')
      .locator('.view-lines'),
    testResult: this.grafanaIframe().getByTestId('data-testid Data source settings page Alert'),
  };
  inputs = {
    clickHouseServerAddress: this.grafanaIframe().getByLabel('Server address', { exact: true }),
    clickHouseServerPort: this.grafanaIframe().getByLabel('Server port', { exact: true }),
    database: this.grafanaIframe().getByPlaceholder('Database', { exact: true }),
    exploreDataSourcePicker: this.grafanaIframe().getByTestId('data-testid Select a data source'),
    exploreSqlEditor: this.grafanaIframe()
      .getByTestId('data-testid Code editor container')
      .getByRole('textbox'),
    host: this.grafanaIframe().getByPlaceholder('localhost:5432'),
    name: this.grafanaIframe().getByTestId('data-testid Data source settings page name input field'),
    password: this.grafanaIframe().getByPlaceholder('Password', { exact: true }),
    user: this.grafanaIframe().getByPlaceholder('Username', { exact: true }),
  };
  messages = {
    exploreAuthenticationFailed: this.grafanaIframe().getByText(
      'Authentication failed: password is incorrect, or there is no user with such name',
    ),
  };

  selectExploreDataSource = async (dataSourceName: string) => {
    await this.inputs.exploreDataSourcePicker.fill(dataSourceName, { timeout: Timeouts.THIRTY_SECONDS });
    await this.builders.exploreDataSourceCard(dataSourceName).click();
  };

  setExploreSqlQuery = async (query: string) => {
    await this.inputs.exploreSqlEditor.press('ControlOrMeta+a', { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.exploreSqlEditor.press('Backspace');
    await this.inputs.exploreSqlEditor.pressSequentially(query);
    await this.inputs.exploreSqlEditor.press('Escape');
  };
}
