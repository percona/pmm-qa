import BasePage from '@pages/base.page';
import EmailInsightsDialogComponent from '@components/advisors/emailInsightsDialog.component';
import RunIdFilterComponent from '@components/advisors/runIdFilter.component';
import { AdvisorCheck, AdvisorInsight } from '@interfaces/advisors';

export type InsightFilter = 'category' | 'nodeName' | 'serviceName' | 'severity' | 'status';

export default class AdvisorInsightsPage extends BasePage {
  readonly url = 'pmm-ui/advisors/insights';
  readonly emailDialog = new EmailInsightsDialogComponent(this.page);
  readonly runIdFilter = new RunIdFilterComponent(this.page);
  builders = {
    actionsButton: (insightId: string) => this.page.getByTestId(`insight-${insightId}-actions`),
    checkDisabledForService: (summary: string, serviceName: string) =>
      this.alertWithText(`Check "${summary}" disabled for ${serviceName}`),
    checkEnabledForService: (summary: string, serviceName: string) =>
      this.alertWithText(`Check "${summary}" enabled for ${serviceName}`),
    detailsField: (label: string) => this.page.getByTestId(`details-field-${label}`),
    filter: (filter: InsightFilter) => this.page.getByTestId(`${filter}-filter`).getByRole('combobox'),
    insightsEmailed: (insights: number, recipients: number) =>
      this.alertWithText(
        `Emailed ${insights} insight${insights === 1 ? '' : 's'} to ${recipients} recipient${recipients === 1 ? '' : 's'}.`,
      ),
    readMoreIndicator: (insightId: string) =>
      this.builders.row(insightId).getByTestId('insight-read-more-indicator'),
    rerunStarted: (summary: string, serviceName: string) =>
      this.alertWithText(`Check "${summary}" started on ${serviceName}, run ID copied to clipboard.`),
    row: (insightId: string) => this.page.getByTestId(`insight-row-${insightId}`),
    rowsWithText: (text: string) => this.elements.rows.filter({ hasText: text }),
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
  inputs = {};
  messages = {
    insightCopied: this.alertWithText('Insight copied to clipboard'),
    insightUrlCopied: this.alertWithText('Insight URL copied to clipboard'),
  };

  // What Copy as text puts on the clipboard for a failed warning.
  copiedTextLines = (insight: AdvisorInsight, check: AdvisorCheck, runId: string) => [
    `The Advisor Check "${insight.summary}" completed at`,
    'with status "Failed"',
    `Run ID: ${runId}`,
    `Check Name: ${check.name}`,
    `Service Name: ${insight.service_name}`,
    `Description: ${check.description}`,
    'Severity: Warning',
  ];

  runUrl = (runId: string) => `${this.url}?runId=${encodeURIComponent(runId)}`;

  selectFilter = async (filter: InsightFilter, option: string) =>
    await this.selectMenuOption(this.builders.filter(filter), option);
}
