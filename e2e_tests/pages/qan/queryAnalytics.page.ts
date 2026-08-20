import { expect, Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import RealTimeAnalyticsPage from '@pages/qan/rta/realTimeAnalytics.page';
import StoredMetricsPage from '@pages/qan/storedMetrics/storedMetrics.page';

enum TabNames {
  realTime = 'Real-Time',
  storedMetrics = 'Stored metrics',
}

export default class QueryAnalyticsPage extends BasePage {
  url = 'pmm-ui/graph/d/pmm-qan';
  rta = new RealTimeAnalyticsPage(this.page);
  rtaSelectionUrl = 'pmm-ui/rta/selection';
  rtaSessionsUrl = 'pmm-ui/rta/sessions';
  rtaUrlPattern = /\/rta\//;
  storedMetrics = new StoredMetricsPage(this.page);
  storedMetricsUrlPattern = /\/pmm-qan\//;
  tabNames = TabNames;
  builders = {
    detailsTab: (tabName: string) => this.grafanaIframe().getByRole('button', { name: tabName }),
    filterCheckbox: (filterName: string) => this.grafanaIframe().getByTestId(`filter-checkbox-${filterName}`),
    filterCheckboxContains: (filterName: string) =>
      this.grafanaIframe().locator(`//div[contains(@data-testid, "filter-checkbox-${filterName}")]`),
    filterGroup: (groupName: string) =>
      this.grafanaIframe().locator(
        `//span[@data-testid="checkbox-group-header" and text()="${groupName}"]/parent::p/parent::div`,
      ),
    filterInGroup: (filterName: string, groupName: string) =>
      this.builders.filterGroup(groupName).locator(`//div[@data-testid="filter-checkbox-${filterName}"]`),
    queryRow: (rowNumber: string) =>
      this.grafanaIframe().locator(`//div[@role="row" and contains(@class, "tr-${rowNumber}")]`),
  };
  buttons = {
    closeDetails: this.grafanaIframe().getByRole('button', { name: 'Close' }),
    copyButton: this.page.getByTestId('qan-header-actions-copy-button'),
    realTimeTab: this.page.getByTestId('qan-header-tabs-real-time-tab'),
    refresh: this.grafanaIframe().getByLabel('Refresh', { exact: true }),
    showSelected: this.grafanaIframe().getByTestId('qan-filters-show-selected'),
    startSessionButton: this.page.getByTestId('start-realtime-session'),
    storedMetricsTab: this.page.getByTestId('qan-header-tabs-historical-tab'),
  };
  elements = {
    codeBlock: this.grafanaIframe().locator(
      '//*[@data-testid="highlight-code" or contains(@class, "pretty-json-container")]',
    ),
    documentationLink: this.page.getByRole('link', { name: 'Documentation' }),
    feedbackLink: this.page.getByRole('link', { name: 'Provide feedback' }),
    histogramContainer: this.grafanaIframe().getByTestId('histogram-collapse-container'),
    iframe: this.page.locator('//*[@id="grafana-iframe"]'),
    noExamples: this.grafanaIframe().locator(
      '//pre[contains(text(), "Sorry, no examples found for this query")]',
    ),
    pageTitle: this.page.getByRole('heading', { name: 'Query Analytics' }),
    queryRows: this.grafanaIframe().locator('//div[@role="row" and contains(@class, "tr-")]'),
    selectedRow: this.grafanaIframe().locator('.selected-overview-row'),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
    topQuery: this.grafanaIframe().getByTestId('top-query'),
    totalItems: this.grafanaIframe().getByTestId('qan-total-items'),
  };
  inputs = {
    filterSearch: this.grafanaIframe().getByTestId('filters-search-field'),
    search: this.grafanaIframe().locator('input[name="search"]'),
  };
  messages = {};

  checkExamplesTab = async (expectNoExamples = false) => {
    await this.openExamplesTab();
    await this.waitForLoaded();
    await expect(this.elements.codeBlock.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    if (expectNoExamples) {
      await expect(this.elements.noExamples).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    } else {
      await expect(this.elements.noExamples).toBeHidden();
    }
  };

  countHistograms = async (): Promise<number> => this.elements.histogramContainer.count();

  getRowCount = async (): Promise<number> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      if ((await this.elements.queryRows.count()) > 1) break;

      await this.buttons.refresh.click();
      await this.waitForLoaded();
    }

    await expect(this.elements.queryRows.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    // Subtract 1 to exclude the TOTAL row.
    return (await this.elements.queryRows.count()) - 1;
  };

  noSpinner = async () => {
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
  };

  openExamplesTab = async () => {
    await this.builders.detailsTab('Examples').click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  searchByValue = async (value: string) => {
    await this.inputs.search.click();
    await this.inputs.search.fill(value);
    await this.inputs.search.press('Enter');
    await this.waitForLoaded();
  };

  selectContainFilter = async (filterName: string) => {
    await this.inputs.filterSearch.fill(filterName);
    await this.builders.filterCheckboxContains(filterName).first().click();
    await this.waitForLoaded();
    await this.inputs.filterSearch.clear();
  };

  selectFilter = async (filterName: string) => {
    await this.inputs.filterSearch.fill(filterName);
    await this.builders.filterCheckbox(filterName).first().click();
    await this.waitForLoaded();
    await this.inputs.filterSearch.clear();
  };

  selectFilterInGroup = async (filterName: string, groupName: string) => {
    await this.inputs.filterSearch.fill(filterName);
    await this.builders.filterInGroup(filterName, groupName).click();
    await this.waitForLoaded();
    await this.inputs.filterSearch.clear();
  };

  selectRow = async (rowNumber: number) => {
    const row: Locator = this.builders.queryRow(String(rowNumber));

    await row.click({ timeout: Timeouts.ONE_MINUTE });
    await this.waitForLoaded();
    await expect(this.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  };

  showSelectedFilters = async () => {
    await this.buttons.showSelected.click();
  };

  switchTab = async (tabName: TabNames) => {
    const tab = this.getTab(tabName);
    const urlPattern = tabName === this.tabNames.realTime ? this.rtaUrlPattern : this.storedMetricsUrlPattern;

    await tab.click();
    await expect(this.page).toHaveURL(urlPattern);
    await this.noSpinner();
  };

  verifyNoExamples = async () => {
    await this.openExamplesTab();
    await this.waitForLoaded();
    await expect(this.elements.noExamples).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyTabIsSelected = async (tabName: TabNames) => {
    const tab = this.getTab(tabName);

    await expect(tab).toHaveAttribute('aria-selected', 'true');
  };

  waitForLoaded = async () => {
    await this.noSpinner();
  };

  waitForTopQuery = async () => {
    await expect(this.elements.topQuery).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  private getTab = (tabName: TabNames) =>
    tabName === this.tabNames.realTime ? this.buttons.realTimeTab : this.buttons.storedMetricsTab;
}
