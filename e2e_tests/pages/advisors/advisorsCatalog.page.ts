import BasePage from '@pages/base.page';
import AdvisorCheckFormComponent from '@components/advisors/advisorCheckForm.component';
import DisableServicesDrawerComponent from '@components/advisors/disableServicesDrawer.component';

export type CatalogFilter = 'category' | 'status' | 'technology';

export default class AdvisorsCatalogPage extends BasePage {
  readonly url = 'pmm-ui/advisors';
  readonly checkForm = new AdvisorCheckFormComponent(this.page);
  readonly servicesDrawer = new DisableServicesDrawerComponent(this.page);
  riskCategories = [
    'Connections',
    'Durability',
    'Logging',
    'Maintenance',
    'Performance',
    'Replication',
    'Resources',
    'Schema & indexes',
    'Security',
    'Versions',
  ];
  builders = {
    checkCreated: (name: string) => this.alertWithText(`Advisor check "${name}" created`),
    checkDeleted: (summary: string) => this.alertWithText(`Check "${summary}" deleted`),
    checkDisabled: (summary: string) => this.alertWithText(`Check "${summary}" disabled`),
    checkDisabledForServices: (count: number) =>
      this.alertWithText(`Check disabled for ${count} service${count === 1 ? '' : 's'}`),
    checkEnabled: (summary: string) => this.alertWithText(`Check "${summary}" enabled`),
    checkReEnabledForService: (serviceName: string) =>
      this.alertWithText(`Check re-enabled for "${serviceName}"`),
    checkStarted: (summary: string) => this.alertWithText(`Check "${summary}" started`),
    checkUpdated: (name: string) => this.alertWithText(`Advisor check "${name}" updated`),
    deleteButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-delete`),
    detailsField: (label: string) => this.page.getByTestId(`check-details-field-${label}`),
    duplicateCheckName: (name: string) => this.alertWithText(`advisor check ${name} already exists`),
    editButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-edit`),
    filter: (filter: CatalogFilter) => this.page.getByTestId(`${filter}-filter`).getByRole('combobox'),
    row: (checkName: string) => this.page.getByTestId(`advisor-row-${checkName}`),
    runButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-run`),
    servicesBadge: (checkName: string) => this.page.getByTestId(`check-${checkName}-services-badge`),
    servicesButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-services`),
    statusSwitch: (checkName: string) =>
      this.page.getByTestId(`check-${checkName}-status-switch`).locator('input'),
  };
  buttons = {
    addAdvisor: this.page.getByTestId('add-advisor'),
    cancelDelete: this.page.getByTestId('delete-advisor-cancel'),
    clearFilters: this.page.getByTestId('clear-filters'),
    cloneCheck: this.page.getByTestId('check-clone'),
    closeDetails: this.page.getByTestId('check-details-close'),
    confirmDelete: this.page.getByTestId('delete-advisor-confirm'),
    copyCheckCode: this.page.getByTestId('check-code-copy'),
    editCheck: this.page.getByTestId('check-edit'),
    refresh: this.page.getByTestId('refresh-checks'),
    runAll: this.page.getByTestId('run-all-checks'),
    runSelected: this.page.getByTestId('run-selected-checks'),
  };
  elements = {
    checkCode: this.page.getByTestId('check-code'),
    deleteDialog: this.page.getByTestId('delete-advisor-dialog'),
    detailsPane: this.page.getByTestId('check-details-pane'),
    pagination: this.page.getByText(/^\d+-\d+ of \d+$/),
    rows: this.page.getByTestId('advisors-list-table').locator('tbody tr'),
    table: this.page.getByTestId('advisors-list-table'),
    title: this.page.getByRole('heading', { name: 'Advisor checks' }),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    search: this.page.getByTestId('advisors-search').getByRole('textbox'),
  };
  messages = {
    checkCodeCopied: this.alertWithText('Check code copied to clipboard'),
    checksAlreadyRunning: this.alertWithText('Advisor checks are already running'),
    checksStarted: this.alertWithText('Advisor checks started, run ID copied to clipboard'),
    scriptIndentedWithTabs: this.alertWithText('script should use spaces for indentation, not tabs'),
  };

  deleteCheck = async (checkName: string) => {
    await this.builders.deleteButton(checkName).click();
    await this.buttons.confirmDelete.click();
  };

  detailsUrl = (checkName: string) => `${this.url}?details=${encodeURIComponent(checkName)}`;

  runCheck = async (checkName: string): Promise<string> =>
    (await this.startRun(this.builders.runButton(checkName))).runId;

  selectFilter = async (filter: CatalogFilter, value: string) =>
    await this.selectMenuOption(this.builders.filter(filter), value);
}
