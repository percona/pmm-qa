import BasePage from '@pages/base.page';
import EmailInsightsDialogComponent from '@components/advisors/emailInsightsDialog.component';
import { expect } from '@playwright/test';

export type InsightFilter = 'category' | 'nodeName' | 'serviceName' | 'severity' | 'status';

export default class AdvisorInsightsPage extends BasePage {
  readonly url = 'pmm-ui/advisors/insights';
  readonly emailDialog = new EmailInsightsDialogComponent(this.page);
  builders = {
    actionsButton: (insightId: string) => this.page.getByTestId(`insight-${insightId}-actions`),
    detailsField: (label: string) => this.page.getByTestId(`details-field-${label}`),
    filter: (filter: InsightFilter) => this.page.getByTestId(`${filter}-filter`).getByRole('combobox'),
    option: (name: string) => this.page.getByRole('option', { exact: true, name }),
    readMoreIndicator: (insightId: string) =>
      this.builders.row(insightId).getByTestId('insight-read-more-indicator'),
    row: (insightId: string) => this.page.getByTestId(`insight-row-${insightId}`),
    rowsWithText: (text: string) => this.elements.rows.filter({ hasText: text }),
    snackbar: (text: string) =>
      this.page.getByRole('alert', { includeHidden: true }).filter({ hasText: text }),
  };
  buttons = {
    clearFilters: this.page.getByTestId('clear-filters'),
    closeDetails: this.page.getByTestId('insight-details-close'),
    copyAsText: this.page.getByTestId('action-copy-as-text'),
    copyUrl: this.page.getByTestId('action-copy-url'),
    disableCheckForService: this.page.getByTestId('action-disable-check'),
    emailInsights: this.page.getByTestId('email-insights'),
    filterByCheckName: this.page.getByTestId('action-filter-by-check-name'),
    filterByRunId: this.page.getByTestId('action-filter-by-run-id'),
    maximizeDetails: this.page.getByTestId('insight-details-maximize'),
    refresh: this.page.getByTestId('refresh-insights'),
    rerunNow: this.page.getByTestId('action-rerun-now'),
    viewDetails: this.page.getByTestId('action-view-details'),
  };
  elements = {
    detailsPane: this.page.getByTestId('insight-details-pane'),
    noData: this.page.getByText('No advisor insights found'),
    readMoreLink: this.builders.detailsField('read-more').getByRole('link'),
    rows: this.page.getByTestId('advisor-insights-table').locator('tbody tr'),
    table: this.page.getByTestId('advisor-insights-table'),
    title: this.page.getByRole('heading', { name: 'Advisor insights' }),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    runId: this.page.getByTestId('run-id-filter').getByRole('textbox'),
  };
  messages = {
    checkDisabledForService: (summary: string, serviceName: string) =>
      this.builders.snackbar(`Check "${summary}" disabled for ${serviceName}`),
    checkEnabledForService: (summary: string, serviceName: string) =>
      this.builders.snackbar(`Check "${summary}" enabled for ${serviceName}`),
    insightCopied: this.builders.snackbar('Insight copied to clipboard'),
    insightsEmailed: (insights: number, recipients: number) =>
      this.builders.snackbar(
        `Emailed ${insights} insight${insights === 1 ? '' : 's'} to ${recipients} recipient${recipients === 1 ? '' : 's'}.`,
      ),
    insightUrlCopied: this.builders.snackbar('Insight URL copied to clipboard'),
    rerunStarted: (summary: string, serviceName: string) =>
      this.builders.snackbar(`Check "${summary}" started on ${serviceName}, run ID copied to clipboard.`),
  };

  filterByRunId = async (runId: string) => {
    await this.inputs.runId.fill(runId);
    await this.inputs.runId.press('Enter');
    await expect(this.page).toHaveURL(new RegExp(`runId=${runId}`));
  };

  openActions = async (insightId: string) => {
    await this.builders.actionsButton(insightId).click();
  };

  runUrl = (runId: string) => `${this.url}?runId=${encodeURIComponent(runId)}`;

  // A click fired while the options menu is still closing is swallowed by its backdrop.
  selectFilter = async (filter: InsightFilter, option: string) => {
    await this.builders.filter(filter).click();
    await this.builders.option(option).click();
    await expect(this.page.getByRole('listbox')).toBeHidden();
    await expect(this.builders.filter(filter)).toHaveText(option);
  };
}
