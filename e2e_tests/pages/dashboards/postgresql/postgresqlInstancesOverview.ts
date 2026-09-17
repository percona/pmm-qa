import { expect, FrameLocator, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import DashboardInterface from '@interfaces/dashboard';
import BasePage from '@pages/base.page';

const executionTimeColumn = 'Execution Time';
const topSlowQueriesPanel = 'Top slow queries';
const topSlowQueriesContent = (frame: FrameLocator) =>
  frame
    .getByTestId(`data-testid Panel header ${topSlowQueriesPanel}`)
    .getByTestId('data-testid panel content');

export default class PostgresqlInstancesOverview extends BasePage implements DashboardInterface {
  readonly url = 'graph/d/postgresql-instance-overview/postgresql-instances-overview';
  readonly topSlowQueriesColumns = [
    'Slowest at',
    'Service',
    'Username',
    'Query',
    'Calls',
    executionTimeColumn,
  ];
  readonly topSlowQueriesPanel = topSlowQueriesPanel;
  // The panel caps its own result set in SQL (PMM-15104); the test asserts against that cap.
  readonly topSlowQueriesRowLimit = 500;
  metrics = [];
  noDataMetrics = [];
  builders = {};
  buttons = {};
  elements = {
    topSlowQueriesGrid: topSlowQueriesContent(this.grafanaIframe()).getByRole('grid'),
    // Grafana's table footer, e.g. "1 - 25 of 315 rows".
    topSlowQueriesPagination: topSlowQueriesContent(this.grafanaIframe()).getByText(
      /\d+\s*-\s*\d+\s+of\s+[\d,]+\s+rows/,
    ),
  };
  inputs = {};
  messages = {};

  // A filterable column's accessible name carries its filter button's label too, so
  // the match has to be a substring one. No two column names overlap, so it stays unambiguous.
  columnHeader = (columnName: string): Locator =>
    this.elements.topSlowQueriesGrid.getByRole('columnheader', { name: columnName });

  /**
   * Reads the Execution Time column by its position in the header row rather than by a
   * fixed index -- keying off a hard-coded column count makes this silently return an
   * empty list, and the ordering assertion vacuous, whenever the column set changes.
   */
  executionTimeValues = async (): Promise<number[]> => {
    const grid = this.elements.topSlowQueriesGrid;
    const headers = await grid.getByRole('columnheader').allInnerTexts();
    const column = headers.findIndex((header) => header.trim() === executionTimeColumn);

    if (column < 0) {
      throw new Error(`No '${executionTimeColumn}' column in the panel; headers were: ${headers}`);
    }

    const rows = await grid.getByRole('row').all();
    const values: number[] = [];

    for (const row of rows) {
      const cells = await row.getByRole('gridcell').all();

      if (cells.length <= column) continue;

      const parsed = Number.parseFloat((await cells[column].innerText()).trim());

      if (!Number.isNaN(parsed)) values.push(parsed);
    }

    return values;
  };

  totalRowCount = async (): Promise<number> => {
    const summary = await this.elements.topSlowQueriesPagination.innerText();
    const total = summary.match(/of\s+([\d,]+)\s+rows/);

    if (!total) throw new Error(`Could not read a row total out of the table footer: '${summary}'`);

    return Number.parseInt(total[1].replaceAll(',', ''), 10);
  };

  /**
   * QAN writes on its own collection cycle, so a run that starts right after provisioning
   * can reach the panel before any query rows exist. Poll rather than assert immediately.
   */
  waitForQueryRows = async (timeout: number = Timeouts.FIVE_MINUTES): Promise<void> => {
    await expect
      .poll(
        async () => ((await this.elements.topSlowQueriesPagination.count()) > 0 ? this.totalRowCount() : 0),
        { message: 'No QAN query rows reached the Top slow queries panel', timeout },
      )
      .toBeGreaterThan(0);
  };
}
