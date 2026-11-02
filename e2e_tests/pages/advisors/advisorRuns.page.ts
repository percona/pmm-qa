import BasePage from '@pages/base.page';
import { Download, expect } from '@playwright/test';

export default class AdvisorRunsPage extends BasePage {
  readonly url = 'pmm-ui/advisors/runs';
  builders = {
    actionsButton: (runId: string) => this.page.getByTestId(`run-${runId}-actions`),
    inProgress: (runId: string) => this.builders.row(runId).getByTestId('run-in-progress'),
    interrupted: (runId: string) => this.builders.row(runId).getByTestId('run-interrupted'),
    option: (name: string) => this.page.getByRole('option', { exact: true, name }),
    // The spinner beside the text never stops moving, so Playwright cannot hover it.
    queuedLabel: (runId: string) => this.builders.row(runId).getByText('Queued…'),
    row: (runId: string) => this.elements.rows.filter({ has: this.page.getByTestId(`run-${runId}-actions`) }),
    services: (runId: string) => this.builders.row(runId).getByTestId('run-services'),
    snackbar: (text: string) =>
      this.page.getByRole('alert', { includeHidden: true }).filter({ hasText: text }),
    startedLate: (runId: string) => this.builders.row(runId).getByTestId('run-started-late'),
  };
  buttons = {
    clearFilters: this.page.getByTestId('clear-run-filters'),
    copyRunId: this.page.getByTestId('action-copy-run-id'),
    exportAllInsights: this.page.getByTestId('action-export-all-insights'),
    exportFailedInsights: this.page.getByTestId('action-export-failed-insights'),
    refresh: this.page.getByTestId('refresh-runs'),
    runAgain: this.page.getByTestId('action-run-again'),
    viewInsights: this.page.getByTestId('action-view-run-insights'),
  };
  elements = {
    header: this.page.getByTestId('advisor-runs-table').locator('thead'),
    noData: this.page.getByText('No Advisor runs recorded yet'),
    rows: this.page.getByTestId('advisor-runs-table').locator('tbody tr'),
    table: this.page.getByTestId('advisor-runs-table'),
    title: this.page.getByRole('heading', { name: 'Advisor runs' }),
    tooltip: this.page.getByRole('tooltip'),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    rowsPerPage: this.page.getByRole('combobox', { name: 'Rows per page' }),
    runId: this.page.getByTestId('run-id-filter').getByRole('textbox'),
    schedule: this.page.getByTestId('schedule-filter').getByRole('combobox'),
    triggeredBy: this.page.getByTestId('triggeredBy-filter').getByRole('combobox'),
  };
  messages = {
    checksStarted: this.builders.snackbar('Advisor checks started'),
    noFailedInsightsToExport: this.builders.snackbar('This run has no failed insights to export'),
    noInsightsToExport: this.builders.snackbar('This run has no insights to export'),
    runIdCopied: this.builders.snackbar('Run ID copied to clipboard'),
  };

  exportInsights = async (runId: string, scope: 'all' | 'failed'): Promise<Download> => {
    await this.openActions(runId);

    const download = this.page.waitForEvent('download');

    await (scope === 'all' ? this.buttons.exportAllInsights : this.buttons.exportFailedInsights).click();

    return await download;
  };

  filterByRunId = async (runId: string) => {
    await this.inputs.runId.fill(runId);
    await this.inputs.runId.press('Enter');
    await expect(this.page).toHaveURL(new RegExp(`runId=${runId}`));
  };

  openActions = async (runId: string) => {
    await this.builders.actionsButton(runId).click();
  };

  selectRowsPerPage = async (size: number) => {
    await this.inputs.rowsPerPage.click();
    await this.builders.option(String(size)).click();
    await expect(this.page.getByRole('listbox')).toBeHidden();
    await expect(this.inputs.rowsPerPage).toHaveText(String(size));
  };

  // A click fired while the options menu is still closing is swallowed by its backdrop.
  selectTriggeredBy = async (triggeredBy: 'All' | 'Scheduler' | 'User') => {
    await this.inputs.triggeredBy.click();
    await this.builders.option(triggeredBy).click();
    await expect(this.page.getByRole('listbox')).toBeHidden();
    await expect(this.inputs.triggeredBy).toHaveText(triggeredBy);
  };
}
