import { expect, Locator } from '@playwright/test';
import { AccessServiceType } from '@interfaces/accessControl';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

const serviceTypes: AccessServiceType[] = ['mongodb', 'mysql', 'postgresql'];

export default class StoredMetricsPage extends BasePage {
  readonly url = 'graph/d/pmm-qan/pmm-query-analytics';
  builders = {
    detailMetricValue: (metricName: string, columnNumber: number) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByText(metricName, { exact: true }) })
        .getByRole('cell')
        .nth(columnNumber - 1)
        .locator('span')
        .first(),
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
    mainMetricOption: (metricName: string) =>
      this.grafanaIframe().locator('.ant-select-item-option-content').filter({ hasText: metricName }),
    overviewColumn: (columnName: string) =>
      this.grafanaIframe().locator('.ant-select-selection-item').filter({ hasText: columnName }),
    overviewColumnOption: (columnName: string) => this.grafanaIframe().getByText(columnName, { exact: true }),
    paginationItem: (pageNumber: string) =>
      this.grafanaIframe().getByRole('listitem', { exact: true, name: pageNumber }),
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
  };
  buttons = {
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
    checkedFilterLabels: this.grafanaIframe().locator(
      'div[data-testid^="filter-checkbox"] input[type="checkbox"]:checked ~ span.checkbox-container__label-text',
    ),
    filterLabels: this.grafanaIframe().locator('.checkbox-container__label-text'),
    firstRow: this.grafanaIframe().locator('//*[@role="row" and @class="tr tr-1"]'),
    iframe: this.page.locator('iframe').first(),
    noData: this.grafanaIframe().locator('//*[@data-testid="table-no-data"]'),
    pageProgressBar: this.page.getByRole('progressbar'),
    pageTitle: this.page.getByRole('heading', { name: 'Query Analytics' }),
    queryRows: this.grafanaIframe().locator('div[role="row"][class*="tr-"]'),
    selectedMainMetric: this.grafanaIframe().getByTestId('group-by').locator('.ant-select-selection-item'),
    selectedRow: this.grafanaIframe().locator('.selected-overview-row'),
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

  changeMainMetric = async (metricName: string) => {
    await this.buttons.mainMetric.click();
    await this.builders.mainMetricOption(metricName).click();
  };

  expandFilterGroup = async (groupName: string) => {
    const showAll = this.builders.filterShowAll(groupName);

    if (await showAll.isVisible()) await showAll.click({ force: true });
  };

  getTotalQueryCount = async () => {
    const countString = await this.elements.totalCount.first().textContent({ timeout: Timeouts.ONE_MINUTE });

    if (!countString) throw new Error('Count of queries is not displayed!');

    const match = countString.match(/of (\d+) items/);

    return match ? parseInt(match[1]) : null;
  };

  refreshIfNoQueries = async () => {
    if ((await this.elements.queryRows.visible().count()) <= 1) await this.buttons.refresh.click();
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

  waitForQanStoredMetricsToHaveData = async (timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    await this.waitUntilQanStoredMetricsLoaded(timeout);

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
