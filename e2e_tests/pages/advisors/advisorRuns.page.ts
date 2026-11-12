import BasePage from '@pages/base.page';
import RunIdFilterComponent from '@components/advisors/runIdFilter.component';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorRun } from '@interfaces/advisors';
import { Download } from '@playwright/test';

const utcTime = (timestamp: string) => new Date(timestamp).toISOString().slice(11, 16);

export default class AdvisorRunsPage extends BasePage {
  readonly url = 'pmm-ui/advisors/runs';
  readonly runIdFilter = new RunIdFilterComponent(this.page);
  readonly tooltips = {
    interrupted:
      'PMM restarted, or the HA leader changed, before the run finished. ' +
      'The insights it saved are kept. Any checks it didn\'t reach show as "Not run".',
    queued: 'Waiting to start. This takes up to a minute.',
  };
  builders = {
    actionsButton: (runId: string) => this.page.getByTestId(`run-${runId}-actions`),
    inProgress: (runId: string) => this.builders.row(runId).getByTestId('run-in-progress'),
    interrupted: (runId: string) => this.builders.row(runId).getByTestId('run-interrupted'),
    // The spinner beside the text never stops moving, so Playwright cannot hover it.
    queuedLabel: (runId: string) => this.builders.row(runId).getByText('Queued…'),
    row: (runId: string) => this.elements.rows.filter({ has: this.page.getByTestId(`run-${runId}-actions`) }),
    services: (runId: string) => this.builders.row(runId).getByTestId('run-services'),
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
    noData: this.page.getByText(
      'No runs yet. Run checks from the Catalog, or wait for the next scheduled run.',
    ),
    rows: this.page.getByTestId('advisor-runs-table').locator('tbody tr'),
    table: this.page.getByTestId('advisor-runs-table'),
    title: this.page.getByRole('heading', { name: 'Advisor run history' }),
    tooltip: this.page.getByRole('tooltip'),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    rowsPerPage: this.page.getByRole('combobox', { name: 'Rows per page' }),
    schedule: this.page.getByTestId('schedule-filter').getByRole('combobox'),
    triggeredBy: this.page.getByTestId('triggeredBy-filter').getByRole('combobox'),
  };
  messages = {
    checksStarted: this.alertWithText('Advisor checks started'),
    noFailedInsightsToExport: this.alertWithText('This run has no failed insights to export'),
    noInsightsToExport: this.alertWithText('This run has no insights to export'),
    runIdCopied: this.alertWithText('Run ID copied to clipboard'),
  };

  exportInsights = async (runId: string, scope: 'all' | 'failed'): Promise<Download> => {
    await this.builders.actionsButton(runId).click();

    const download = this.page.waitForEvent('download');

    await (scope === 'all' ? this.buttons.exportAllInsights : this.buttons.exportFailedInsights).click();

    return await download;
  };

  selectRowsPerPage = async (size: number) =>
    await this.selectMenuOption(this.inputs.rowsPerPage, String(size));

  selectTriggeredBy = async (triggeredBy: 'All' | 'Scheduler' | 'User') =>
    await this.selectMenuOption(this.inputs.triggeredBy, triggeredBy);

  startedLateTooltip = (run: AdvisorRun, blocker: AdvisorRun, who: string) => {
    const scheduledFor = run.scheduled_for as string;
    const minutesLate = Math.round(
      (Date.parse(run.started_at) - Date.parse(scheduledFor)) / Timeouts.ONE_MINUTE,
    );

    return (
      `Scheduled for ${utcTime(scheduledFor)} UTC. Started ${minutesLate} min late ` +
      `because it waited for ${who}, which started at ${utcTime(blocker.started_at)} UTC.`
    );
  };
}
