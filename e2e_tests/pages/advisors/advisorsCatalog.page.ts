import BasePage from '@pages/base.page';
import apiEndpoints from '@helpers/apiEndpoints';
import { expect } from '@playwright/test';
import AdvisorCheckFormComponent from '@components/advisors/advisorCheckForm.component';
import DisableServicesDrawerComponent from '@components/advisors/disableServicesDrawer.component';

export type CatalogFilter = 'category' | 'status' | 'technology';

export default class AdvisorsCatalogPage extends BasePage {
  readonly url = 'pmm-ui/advisors';
  readonly checkForm = new AdvisorCheckFormComponent(this.page);
  readonly servicesDrawer = new DisableServicesDrawerComponent(this.page);
  builders = {
    deleteButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-delete`),
    detailsField: (label: string) => this.page.getByTestId(`check-details-field-${label}`),
    editButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-edit`),
    filter: (filter: CatalogFilter) => this.page.getByTestId(`${filter}-filter`).getByRole('combobox'),
    option: (name: string) => this.page.getByRole('option', { exact: true, name }),
    row: (checkName: string) => this.page.getByTestId(`advisor-row-${checkName}`),
    runButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-run`),
    servicesBadge: (checkName: string) => this.page.getByTestId(`check-${checkName}-services-badge`),
    servicesButton: (checkName: string) => this.page.getByTestId(`check-${checkName}-services`),
    snackbar: (text: string) =>
      this.page.getByRole('alert', { includeHidden: true }).filter({ hasText: text }),
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
    checkCodeCopied: this.builders.snackbar('Check code copied to clipboard'),
    checkCreated: (name: string) => this.builders.snackbar(`Advisor check "${name}" created`),
    checkDeleted: (summary: string) => this.builders.snackbar(`Check "${summary}" deleted`),
    checkDisabled: (summary: string) => this.builders.snackbar(`Check "${summary}" disabled`),
    checkDisabledForServices: (count: number) =>
      this.builders.snackbar(`Check disabled for ${count} service${count === 1 ? '' : 's'}`),
    checkEnabled: (summary: string) => this.builders.snackbar(`Check "${summary}" enabled`),
    checkReEnabledForService: (serviceName: string) =>
      this.builders.snackbar(`Check re-enabled for "${serviceName}"`),
    checksAlreadyRunning: this.builders.snackbar('Advisor checks are already running'),
    checksStarted: this.builders.snackbar('Advisor checks started, run ID copied to clipboard'),
    checkStarted: (summary: string) => this.builders.snackbar(`Check "${summary}" started`),
    checkUpdated: (name: string) => this.builders.snackbar(`Advisor check "${name}" updated`),
    duplicateCheckName: (name: string) => this.builders.snackbar(`advisor check ${name} already exists`),
    scriptIndentedWithTabs: this.builders.snackbar('script should use spaces for indentation, not tabs'),
  };

  deleteCheck = async (checkName: string) => {
    await this.builders.deleteButton(checkName).click();
    await this.buttons.confirmDelete.click();
  };

  detailsUrl = (checkName: string) => `${this.url}?details=${encodeURIComponent(checkName)}`;

  // Returns the ID of the run the click starts.
  runCheck = async (checkName: string): Promise<string> => {
    const started = this.page.waitForResponse(
      (response) => response.url().includes(apiEndpoints.advisors.start) && response.ok(),
    );

    await this.builders.runButton(checkName).click();

    return ((await (await started).json()) as { run_id: string }).run_id;
  };

  // A click fired while the options menu is still closing is swallowed by its backdrop.
  selectFilter = async (filter: CatalogFilter, value: string) => {
    await this.builders.filter(filter).click();
    await this.builders.option(value).click();
    await expect(this.page.getByRole('listbox')).toBeHidden();
    await expect(this.builders.filter(filter)).toHaveText(value);
  };
}
