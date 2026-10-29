import { expect, Locator } from '@playwright/test';
import { AccessServiceType } from '@interfaces/accessControl';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

const serviceTypes: AccessServiceType[] = ['mongodb', 'mysql', 'postgresql'];
const workloadRows = 'div[role="row"][class*="tr-"]:not(.tr-0)';

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
    filterLink: (filterName: string, groupName: string) =>
      this.builders
        .filterCheckboxInGroup(filterName, groupName)
        .getByRole('link', { name: 'Open dashboard' }),
    filterPercentage: (filterName: string, groupName: string) =>
      this.builders.filterCheckboxInGroup(filterName, groupName).getByText(/%$/),
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
    resultsPerPageOption: (option: string) =>
      this.grafanaIframe().getByRole('option', { exact: true, name: option }),
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
    workloadRowsWithoutText: (text: string) =>
      this.grafanaIframe().locator(workloadRows).filter({ hasNotText: text }),
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
    classicExplainError: this.grafanaIframe().getByTestId('classic-explain-error'),
    codeBlock: this.grafanaIframe()
      .getByTestId('highlight-code')
      .or(this.grafanaIframe().locator('.pretty-json-container')),
    detailsNoData: this.grafanaIframe().getByTestId('query-analytics-details').getByTestId('table-no-data'),
    emptyPlan: this.grafanaIframe().locator('pre').filter({ hasText: 'No plan found' }),
    explainError: this.grafanaIframe().getByTestId('json-explain-error'),
    filterCheckboxes: this.grafanaIframe().getByTestId(/filter-checkbox/),
    filterLabels: this.grafanaIframe().locator('.checkbox-container__label-text'),
    firstRow: this.grafanaIframe().locator('//*[@role="row" and @class="tr tr-1"]'),
    firstWorkloadRow: this.grafanaIframe()
      .locator(workloadRows)
      .filter({ hasNot: this.page.getByRole('cell', { name: /^explain\b/i }) })
      .first(),
    iframe: this.page.locator('iframe').first(),
    latencyChart: this.grafanaIframe().locator('.latency-chart-container'),
    metricTooltip: this.grafanaIframe().locator('.ant-tooltip-content'),
    noClassicExplain: this.grafanaIframe().locator('pre').filter({ hasText: 'No classic explain found' }),
    noData: this.grafanaIframe().locator('//*[@data-testid="table-no-data"]'),
    noDataMessage: this.grafanaIframe().getByTestId('table-no-data').getByRole('heading', { level: 1 }),
    noExamples: this.grafanaIframe()
      .locator('pre')
      .filter({ hasText: 'Sorry, no examples found for this query' }),
    noJsonExplain: this.grafanaIframe().locator('pre').filter({ hasText: 'No JSON explain found' }),
    noTable: this.grafanaIframe()
      .locator('pre')
      .filter({ hasText: 'No table info from example nor explain' }),
    overviewColumnTooltip: this.grafanaIframe().locator('.overview-column-tooltip'),
    overviewNoData: this.grafanaIframe().getByRole('rowgroup').getByTestId('table-no-data'),
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
    resultsPerPage: this.grafanaIframe()
      .getByLabel('Page Size', { exact: true })
      .locator('.ant-select-selection-item'),
    selectedMainMetric: this.grafanaIframe().getByTestId('group-by').locator('.ant-select-selection-item'),
    selectedRow: this.grafanaIframe().locator('.selected-overview-row'),
    selectedRowCell: this.grafanaIframe().locator('.selected-overview-row > div').first(),
    selectedRowQueryText: this.grafanaIframe().locator('.selected-overview-row').getByRole('cell').nth(1),
    sparklineTooltip: this.grafanaIframe().locator('div.tippy-content'),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
    tableTabs: this.grafanaIframe()
      .getByRole('tablist')
      .filter({ hasNot: this.page.getByRole('tab', { exact: true, name: 'Details' }) })
      .getByRole('tab'),
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
      if (text.trim() === 'N/A') return 0;

      const [value, unit = ''] = text.replace('<', '').trim().split(' ');
      const magnitudes: Record<string, number> = { b: 1e9, k: 1e3, m: 1e6 };
      const timeUnits: Record<string, number> = { min: 60, ms: 1e-3, s: 1, µs: 1e-6 };

      return parseFloat(value) * (magnitudes[value.slice(-1)] ?? 1) * (timeUnits[unit] ?? 1);
    });

  /** Rate, sum and per-query values of each metric in the Details tab, without the share of the total. */
  getDetailMetricValues = async (metricNames: string[]) => {
    const values: Record<string, string[]> = {};

    for (const metricName of metricNames) {
      await expect(this.builders.detailMetricValue(metricName, 3)).not.toBeEmpty({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      values[metricName] = [];

      for (const columnNumber of [2, 3, 4]) {
        values[metricName].push(
          ((await this.builders.detailMetricValue(metricName, columnNumber).textContent()) ?? '').trim(),
        );
      }
    }

    return values;
  };

  getPlanId = async () => {
    await this.elements.planInfoIcon.hover();
    await expect(this.elements.planTooltip).toHaveText(/:\s*\S+/, { timeout: Timeouts.THIRTY_SECONDS });

    return ((await this.elements.planTooltip.textContent()) ?? '').split(':')[1].trim();
  };

  getQpsTooltipValue = async () =>
    (await this.elements.qpsTooltip.textContent())?.split(':')[1]?.trim().split(' ')[0];

  getQueryCount = async () => {
    await expect(this.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    const count = await this.getTotalQueryCount();

    if (count === null) throw new Error('Count of queries is not displayed!');

    return count;
  };

  getQueryId = async (rowNumber: number) => {
    await this.hoverQueryInfo(rowNumber);
    await expect(this.elements.queryTooltipId).toHaveText(/:\s*\S+/);

    return ((await this.elements.queryTooltipId.textContent()) ?? '').split(':')[1].trim();
  };

  getQueryText = async (rowNumber: number) => {
    await expect(this.builders.queryRowQueryText(rowNumber)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    return ((await this.builders.queryRowQueryText(rowNumber).textContent()) ?? '').replace(/ /g, '');
  };

  getQueryTooltipText = async () =>
    ((await this.elements.queryTooltipText.textContent()) ?? '').replace(/ |\n/g, '');

  getQueryValue = async (rowNumber: number, columnNumber: number) => {
    await expect(this.builders.queryValue(rowNumber, columnNumber)).not.toBeEmpty({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    return (await this.builders.queryValue(rowNumber, columnNumber).textContent()) ?? '';
  };

  getTotalQueryCount = async () => {
    const countString = await this.elements.totalCount.first().textContent({ timeout: Timeouts.ONE_MINUTE });

    if (!countString) throw new Error('Count of queries is not displayed!');

    const match = countString.match(/of (\d+) items/);

    return match ? parseInt(match[1]) : null;
  };

  hideTooltip = async () => {
    await this.inputs.addColumn.hover();
    await expect(this.elements.metricTooltip).toBeHidden({ timeout: Timeouts.FIVE_SECONDS });
  };

  hoverQueryInfo = async (rowNumber: number) => {
    await this.builders.queryInfoIcon(rowNumber).hover();
    await expect(this.elements.queryTooltipText).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  openExamplesTab = async () => {
    await this.builders.tab('Examples').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.waitForLoad();
    await expect(this.elements.codeBlock.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  openInNewTab = async (url: string) => {
    const page = await this.page.context().newPage();
    const storedMetrics = new StoredMetricsPage(page);

    await page.goto(url);
    await storedMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.ONE_MINUTE);

    return { page, storedMetrics };
  };

  openPlanTab = async () => {
    await this.builders.tab('Plan').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.waitForLoad();
  };

  openQueryDetails = async (url: string) => {
    await expect(async () => {
      await this.page.goto(url);
      await this.waitForLoad();
      await expect(this.elements.firstWorkloadRow).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await this.selectFirstWorkloadRow();
  };

  refreshIfNoQueries = async () => {
    if ((await this.elements.queryRows.visible().count()) <= 1) await this.buttons.refresh.click();
  };

  removeColumn = async (columnName: string) => {
    await this.builders.columnHeader(columnName).click();
    await this.elements.removeColumnOption.click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  searchByQueryText = async (value: string) => {
    await this.searchByValue(value);
    await this.builders
      .queryRowQueryText(1)
      .filter({ hasText: value })
      .waitFor({ timeout: Timeouts.THIRTY_SECONDS });
    await this.builders
      .workloadRowsWithoutText(value)
      .first()
      .waitFor({ state: 'detached', timeout: Timeouts.THIRTY_SECONDS });
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

  selectFilterContaining = async (text: string) => {
    await this.selectFilter(text, this.builders.filterCheckboxContaining(text));
    await this.waitForLoad();
  };

  selectFirstWorkloadRow = async () => {
    await this.elements.firstWorkloadRow.click({ timeout: Timeouts.ONE_MINUTE });
    await this.waitForLoad();
    await expect(this.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  };

  selectRefreshInterval = async (interval: string) => {
    await this.buttons.refreshInterval.click();
    await this.builders.refreshIntervalOption(interval).click();
  };

  selectResultsPerPage = async (option: '25 / page' | '50 / page' | '100 / page') => {
    await this.elements.resultsPerPage.click();
    await this.builders.resultsPerPageOption(option).click();
    await this.waitForLoad();
  };

  selectRow = async (rowNumber: number) => {
    await this.builders.queryRow(rowNumber).click({ timeout: Timeouts.ONE_MINUTE });
    await this.waitForLoad();
    await expect(this.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  };

  sortColumn = async (columnNumber: number, direction: 'asc' | 'desc') => {
    await this.builders
      .sortControl(columnNumber)
      .dispatchEvent('click', undefined, { timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.builders.sortingValue(columnNumber)).toContainClass(`sort-by ${direction}`, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  };

  verifyActivePage = async (pageNumber: number, range?: string) => {
    await expect(this.builders.paginationItem(String(pageNumber))).toContainClass(
      'ant-pagination-item-active',
    );

    if (range) await this.verifyPaginationRange(range);
  };

  verifyAveragePerQuery = async (timeRangeInSeconds: number) => {
    await expect(async () => {
      const read = async (metricName: string, columnNumber: number) => {
        const text = (
          (await this.builders.detailMetricValue(metricName, columnNumber).textContent()) ?? ''
        ).trim();

        expect(text, `${metricName} column ${columnNumber} should show a value`).not.toBe('');

        return text;
      };

      const magnitudes: Record<string, number> = { b: 1e9, k: 1e3, m: 1e6, t: 1e12 };
      const queryCountText = await read('Query Count', 3);
      const queryCount =
        parseFloat(queryCountText) * (magnitudes[queryCountText.slice(-1).toLowerCase()] ?? 1);
      const [perQueryTime, perQueryUnit] = (await read('Query Time', 4)).split(' ');
      const timeUnits: Record<string, number> = { ms: 1e-3, µs: 1e-6 };

      const verifyRate = (metricName: string, value: string, rate: number, humanizedInputs: number) => {
        const expected = Number(rate.toFixed(4));
        const message = `${metricName} rate ${value} should match the calculated ${expected}`;

        if (expected < 0.01) {
          expect(value, message).toMatch(/^<0\.01/);
        } else if (expected <= 0.0149) {
          expect(value, message).toMatch(/^0\.01/);
        } else {
          expect(Math.abs(parseFloat(value) - expected), message).toBeLessThanOrEqual(
            0.005 + expected * (1 / 0.995 ** humanizedInputs - 1),
          );
        }
      };

      verifyRate('Query Count', await read('Query Count', 2), queryCount / timeRangeInSeconds, 1);
      verifyRate(
        'Query Time',
        await read('Query Time', 2),
        (queryCount * parseFloat(perQueryTime) * (timeUnits[perQueryUnit] ?? 1)) / timeRangeInSeconds,
        2,
      );
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyColumnSorted = async (columnNumber: number, direction: 'asc' | 'desc') => {
    await expect(async () => {
      const values = await this.getColumnValues(columnNumber);

      expect(values, `Column ${columnNumber} should show values`).not.toHaveLength(0);
      expect(
        values.filter((value) => !Number.isFinite(value)),
        `Column ${columnNumber} values should all be numeric`,
      ).toHaveLength(0);
      expect(values, `Column ${columnNumber} values should follow the "${direction}" sort`).toEqual(
        [...values].sort((a, b) => (direction === 'asc' ? b - a : a - b)),
      );
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyExplain = async (allowUnsupported = false) => {
    await this.builders.tab('Explain').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.waitForLoad();
    await expect(this.elements.codeBlock.or(this.elements.explainError).first()).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      allowUnsupported
        ? this.elements.explainError.filter({
            hasNotText: /not supported for explain|cannot explain this type of query/i,
          })
        : this.elements.explainError,
    ).toBeHidden();
  };

  verifyLoadSparklineTooltip = async (rowNumber: number, text: string) => {
    await expect(async () => {
      await this.inputs.addColumn.hover();
      await this.builders.loadSparkline(rowNumber).hover();
      await expect(this.elements.sparklineTooltip).toContainText(text, { timeout: Timeouts.FIVE_SECONDS });
    }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyNoExplainErrors = async () => {
    const { codeBlock, explainError, noClassicExplain, noJsonExplain } = this.elements;

    await this.builders.tab('Explain').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.waitForLoad();
    await expect(codeBlock.or(noClassicExplain).or(noJsonExplain).or(explainError).first()).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    for (const message of [noClassicExplain, noJsonExplain, explainError]) await expect(message).toBeHidden();
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

  verifyPagesAndCount = async (itemsPerPage: number) => {
    await expect
      .poll(
        async () => {
          const totalCount = (await this.getTotalQueryCount()) ?? 0;
          const lastPage = Number(await this.buttons.lastPage.getAttribute('title'));

          return totalCount > 0 && lastPage === Math.ceil(totalCount / itemsPerPage);
        },
        {
          message: `Last page does not match total count at ${itemsPerPage} per page`,
          timeout: Timeouts.THIRTY_SECONDS,
        },
      )
      .toBe(true);
  };

  verifyPaginationRange = async (range: string) => {
    await expect(this.elements.totalCount).toHaveText(new RegExp(`^${range} of \\d+ items$`));
  };

  verifyPlan = async () => {
    await this.openPlanTab();
    await expect(this.elements.emptyPlan).toBeHidden();
  };

  verifyPlanShown = async () => {
    await expect(this.elements.noClassicExplain).toBeHidden();
    await expect(this.elements.noJsonExplain).toBeHidden();
    await expect(this.elements.explainError).toBeHidden();
    await expect(this.elements.emptyPlan).toBeHidden();
    await expect(this.elements.planText).toBeVisible({ timeout: Timeouts.TWENTY_SECONDS });
    await expect(this.elements.planText).not.toBeEmpty();
  };

  verifyQanStoredMetricsHaveData = async () => {
    await this.waitUntilQanStoredMetricsLoaded();
    await expect(this.elements.noData).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.elements.firstRow).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyTables = async () => {
    await this.builders.tab('Tables').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.waitForLoad();
    await expect(this.elements.tableTabs.first()).toBeVisible({ timeout: Timeouts.TWO_SECONDS });

    for (const table of await this.elements.tableTabs.visible().all()) {
      await table.click();
      await this.waitForLoad();
      await expect(this.elements.codeBlock.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(this.elements.noTable).toBeHidden();
    }
  };

  verifyTotalQueryCount = async (expectedQueryCount: number) => {
    expect(await this.getTotalQueryCount()).toEqual(expectedQueryCount);
  };

  waitForLoad = async () => {
    await expect(this.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
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
