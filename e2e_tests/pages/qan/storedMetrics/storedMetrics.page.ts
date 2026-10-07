import { expect, Locator } from '@playwright/test';
import { AccessServiceType } from '@interfaces/accessControl';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

const serviceTypes: AccessServiceType[] = ['mongodb', 'mysql', 'postgresql'];

export default class StoredMetricsPage extends BasePage {
  readonly url = 'graph/d/pmm-qan/pmm-query-analytics';
  builders = {
    columnHeader: (columnName: string) =>
      this.grafanaIframe()
        .getByRole('columnheader', { exact: true, name: columnName })
        .getByTestId('manage-columns-selector'),
    columnValues: (columnNumber: number) =>
      this.grafanaIframe().locator(
        `div[role="row"][class*="tr-"]:not(.tr-0) > div:nth-child(${columnNumber + 2}) span > div > span`,
      ),
    detailMetricValue: (metricName: string, columnNumber: number) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByText(metricName, { exact: true }) })
        .getByRole('cell')
        .nth(columnNumber - 1)
        .locator('span')
        .first(),
    filterCheckboxContaining: (text: string) =>
      this.grafanaIframe().locator('[data-testid*="filter-checkbox"]').filter({ hasText: text }).first(),
    filterCheckboxesInGroup: (groupName: string) =>
      this.builders.filterGroup(groupName).locator('[data-testid*="filter-checkbox"]'),
    filterCheckboxInGroup: (filterName: string, groupName: string) =>
      this.builders.filterGroup(groupName).getByTestId(`filter-checkbox-${filterName}`),
    filterGroup: (groupName: string) =>
      this.grafanaIframe()
        .getByTestId('checkbox-group-header')
        .filter({ hasText: groupName })
        .locator('xpath=../..'),
    filterLabelsInGroup: (groupName: string) =>
      this.builders.filterCheckboxesInGroup(groupName).locator('.checkbox-container__label-text'),
    filterShowAll: (groupName: string) => this.builders.filterGroup(groupName).getByText('Show all'),
    loadSparkline: (rowNumber: number) => this.builders.queryRow(rowNumber).locator('.td canvas'),
    mainMetricOption: (metricName: string) =>
      this.grafanaIframe().locator('.ant-select-item-option-content').filter({ hasText: metricName }),
    overviewColumn: (columnName: string) =>
      this.grafanaIframe().locator('.ant-select-selection-item').filter({ hasText: columnName }),
    overviewColumnOption: (columnName: string) => this.grafanaIframe().getByText(columnName, { exact: true }),
    paginationItem: (pageNumber: string) =>
      this.grafanaIframe().getByRole('listitem', { exact: true, name: pageNumber }),
    queryInfoIcon: (rowNumber: number) => this.builders.queryRowQueryText(rowNumber).locator('svg'),
    queryRow: (rowNumber: number) => this.grafanaIframe().locator(`div[role="row"].tr-${rowNumber}`),
    queryRowQueryText: (rowNumber: number) => this.builders.queryRow(rowNumber).getByRole('cell').nth(1),
    queryValue: (rowNumber: number, columnNumber: number) =>
      this.builders
        .queryRow(rowNumber)
        .locator(`:scope > div:nth-child(${columnNumber + 2}) span > div > span`),
    refreshIntervalOption: (interval: string) =>
      this.grafanaIframe()
        .getByRole('menuitemradio')
        .filter({ has: this.page.getByText(interval, { exact: true }) }),
    serviceTypeCheckbox: (serviceType: string) =>
      this.grafanaIframe().getByTestId(`filter-checkbox-${serviceType}`),
    serviceTypeFilter: (serviceType: string) =>
      this.grafanaIframe().locator(`input[name="service_type;${serviceType}"]`),
    serviceTypeLabel: (serviceType: string) =>
      this.grafanaIframe()
        .locator('label')
        .filter({ has: this.builders.serviceTypeFilter(serviceType) }),
    sortControl: (columnNumber: number) =>
      this.grafanaIframe()
        .getByTestId('sort-by-control')
        .nth(columnNumber - 1),
    sortingValue: (columnNumber: number) => this.builders.sortControl(columnNumber).locator('span'),
    tab: (tabName: string) => this.grafanaIframe().getByRole('tab', { name: tabName }),
  };
  buttons = {
    closeDetails: this.grafanaIframe().getByRole('button', { name: 'Close' }),
    detailsTab: this.grafanaIframe().getByRole('tab', { name: 'Details' }),
    ellipsis: this.grafanaIframe().locator('.ant-pagination-item-ellipsis'),
    lastPage: this.grafanaIframe().locator('.ant-pagination-item').last(),
    mainMetric: this.grafanaIframe().getByTestId('group-by'),
    nextPage: this.grafanaIframe().getByRole('listitem', { exact: true, name: 'Next Page' }),
    previousPage: this.grafanaIframe().getByRole('listitem', { exact: true, name: 'Previous Page' }),
    refresh: this.grafanaIframe().getByTestId('data-testid RefreshPicker run button'),
    refreshInterval: this.grafanaIframe().getByTestId('data-testid RefreshPicker interval button'),
    resetAll: this.grafanaIframe().getByTestId('qan-filters-reset-all'),
    showSelected: this.grafanaIframe().getByTestId('qan-filters-show-selected'),
  };
  elements = {
    addColumnButton: this.grafanaIframe().getByText('Add column'),
    addColumnNoData: this.grafanaIframe().locator('div.ant-empty-image'),
    checkedFilterLabels: this.grafanaIframe().locator(
      'div[data-testid^="filter-checkbox"] input[type="checkbox"]:checked ~ span.checkbox-container__label-text',
    ),
    emptyPlan: this.grafanaIframe().locator('pre').filter({ hasText: 'No plan found' }),
    explainError: this.grafanaIframe().getByTestId('json-explain-error'),
    filterLabels: this.grafanaIframe().locator('.checkbox-container__label-text'),
    firstRow: this.grafanaIframe().locator('//*[@role="row" and @class="tr tr-1"]'),
    iframe: this.page.locator('iframe').first(),
    latencyChart: this.grafanaIframe().locator('.latency-chart-container'),
    metricTooltip: this.grafanaIframe().locator('.ant-tooltip-content'),
    noClassicExplain: this.grafanaIframe().locator('pre').filter({ hasText: 'No classic explain found' }),
    noData: this.grafanaIframe().locator('//*[@data-testid="table-no-data"]'),
    noJsonExplain: this.grafanaIframe().locator('pre').filter({ hasText: 'No JSON explain found' }),
    overviewColumnTooltip: this.grafanaIframe().locator('.overview-column-tooltip'),
    pageProgressBar: this.page.getByRole('progressbar'),
    pageTitle: this.page.getByRole('heading', { name: 'Query Analytics' }),
    planInfoIcon: this.grafanaIframe().getByTestId('query-analytics-details').getByTestId('icon-info-circle'),
    planText: this.grafanaIframe().getByTestId('query-analytics-details').locator('pre code'),
    planTooltip: this.grafanaIframe().getByTestId('data-testid tooltip'),
    qpsTooltip: this.grafanaIframe().getByTestId('qps'),
    queryRows: this.grafanaIframe().locator('div[role="row"][class*="tr-"]'),
    queryTooltipId: this.grafanaIframe().getByRole('tooltip').getByRole('heading'),
    queryTooltipText: this.grafanaIframe().getByRole('tooltip').getByTestId('highlight-code'),
    removeColumnOption: this.grafanaIframe().getByText('Remove column', { exact: true }),
    selectedMainMetric: this.grafanaIframe().getByTestId('group-by').locator('.ant-select-selection-item'),
    selectedRow: this.grafanaIframe().locator('.selected-overview-row'),
    selectedRowCell: this.grafanaIframe().locator('.selected-overview-row > div').first(),
    sparklineTooltip: this.grafanaIframe().locator('div.tippy-content'),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
    totalCount: this.grafanaIframe().locator('//*[@data-testid="qan-total-items"]'),
  };
  inputs = {
    addColumn: this.grafanaIframe().locator('.add-columns-selector input'),
    filterBy: this.grafanaIframe().getByTestId('filters-search-field'),
    search: this.grafanaIframe().locator('input[name="search"]'),
  };
  messages = {};

  addColumn = async (columnName: string) => {
    await this.inputs.addColumn.fill(columnName, { timeout: Timeouts.THIRTY_SECONDS });
    await this.builders.overviewColumnOption(columnName).click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  changeColumnMetric = async (columnName: string, metricName: string) => {
    await this.builders.columnHeader(columnName).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.builders.overviewColumnOption(metricName).click();
  };

  changeMainMetric = async (metricName: string) => {
    await this.buttons.mainMetric.click();
    await this.builders.mainMetricOption(metricName).click();
  };

  expandFilterGroup = async (groupName: string) => {
    const showAll = this.builders.filterShowAll(groupName);

    if (await showAll.isVisible()) await showAll.click({ force: true });
  };

  getColumnValues = async (columnNumber: number) =>
    (await this.builders.columnValues(columnNumber).allTextContents()).map((text) => {
      const [value, unit = ''] = text.replace('<', '').trim().split(' ');
      const magnitudes: Record<string, number> = { b: 1e9, k: 1e3, m: 1e6 };
      const timeUnits: Record<string, number> = { min: 60, ms: 1e-3, s: 1, µs: 1e-6 };

      return parseFloat(value) * (magnitudes[value.slice(-1)] ?? 1) * (timeUnits[unit] ?? 1);
    });

  getTotalQueryCount = async () => {
    const countString = await this.elements.totalCount.first().textContent({ timeout: Timeouts.ONE_MINUTE });

    if (!countString) throw new Error('Count of queries is not displayed!');

    const match = countString.match(/of (\d+) items/);

    return match ? parseInt(match[1]) : null;
  };

  refreshIfNoQueries = async () => {
    if ((await this.elements.queryRows.visible().count()) <= 1) await this.buttons.refresh.click();
  };

  removeColumn = async (columnName: string) => {
    await this.builders.columnHeader(columnName).click();
    await this.elements.removeColumnOption.click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  searchByValue = async (value: string) => {
    await this.builders.queryRow(0).waitFor({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.search.fill(value, { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.search.press('Enter');
  };

  selectFilter = async (value: string, checkbox: Locator) => {
    await this.inputs.filterBy.fill(value, { timeout: Timeouts.THIRTY_SECONDS });
    await checkbox.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.filterBy.fill('');
  };

  selectRefreshInterval = async (interval: string) => {
    await this.buttons.refreshInterval.click();
    await this.builders.refreshIntervalOption(interval).click();
  };

  verifyOnlyServiceTypeVisible = async (expected: AccessServiceType) => {
    await expect(this.elements.pageTitle).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await this.waitUntilQanStoredMetricsLoaded(Timeouts.TWO_MINUTES);
    await expect(this.elements.pageProgressBar).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.elements.iframe).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    const disallowedServiceTypes = serviceTypes.filter((value) => value !== expected);

    await expect(this.builders.serviceTypeCheckbox(expected)).toBeVisible({
      timeout: Timeouts.ONE_MINUTE,
    });

    for (const serviceType of disallowedServiceTypes) {
      await expect(this.builders.serviceTypeCheckbox(serviceType)).toHaveCount(0);
    }
  };

  verifyQanStoredMetricsHaveData = async () => {
    await this.waitUntilQanStoredMetricsLoaded();
    await expect(this.elements.noData).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.elements.firstRow).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyTotalQueryCount = async (expectedQueryCount: number) => {
    expect(await this.getTotalQueryCount()).toEqual(expectedQueryCount);
  };

  waitForQanStoredMetricsToHaveData = async (timeout: Timeouts = Timeouts.THIRTY_SECONDS) => {
    await this.waitUntilQanStoredMetricsLoaded(Timeouts.ONE_MINUTE);

    const noDataLocator = this.elements.noData;
    const timeoutInSeconds = timeout / Timeouts.ONE_SECOND;

    for (let i = 0; i < timeoutInSeconds; i++) {
      // eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: Replace with a better approach
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);

      if (!(await noDataLocator.isVisible())) return;
    }

    await expect(noDataLocator).not.toBeVisible({
      timeout: Timeouts.ONE_SECOND,
    });
  };

  waitUntilQanStoredMetricsLoaded = async (timeout: Timeouts = Timeouts.THIRTY_SECONDS) => {
    await expect(async () => {
      await expect(this.elements.spinner.first()).toBeHidden({ timeout });

      if (await this.elements.noData.isVisible()) {
        await this.page.reload();
      }

      await expect(this.elements.noData).toBeHidden({ timeout: Timeouts.ONE_SECOND });
      await expect(this.elements.firstRow).toBeVisible({ timeout: Timeouts.ONE_SECOND });
    }).toPass({
      intervals: [Timeouts.ONE_SECOND],
      timeout,
    });
  };
}
