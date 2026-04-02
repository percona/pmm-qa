import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import QueryAnalyticsDetails from '@components/qan/storedMetrics/queryAnalyticsDetails.component';

export default class StoredMetricsPage extends BasePage {
  readonly url = 'graph/d/pmm-qan/pmm-query-analytics';
  qanDetails = new QueryAnalyticsDetails(this.page);
  builders = {};
  buttons = {};
  elements = {
    firstRow: this.grafanaIframe().locator('//*[@role="row" and @class="tr tr-1"]'),
    noData: this.grafanaIframe().locator('//*[@data-testid="table-no-data"]'),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
    totalCount: this.grafanaIframe().locator('//*[@data-testid="qan-total-items"]'),
  };
  inputs = {};
  messages = {};

  verifyQanStoredMetricsHaveData = async () => {
    await this.waitUntilQanStoredMetricsLoaded();
    await expect(this.elements.noData).toBeHidden({ timeout: 30_000 });
    await expect(this.elements.firstRow).toBeVisible({ timeout: 30_000 });
  };

  verifyTotalQueryCount = async (expectedQueryCount: number) => {
    const countString = await this.elements.totalCount.first().textContent({ timeout: Timeouts.ONE_MINUTE });

    if (!countString) throw new Error('Count of queries is not displayed!');

    const match = countString.match(/of (\d+) items/);
    const queryCount = match ? parseInt(match[1], 10) : null;

    expect(queryCount).toEqual(expectedQueryCount);
  };

  waitForQanStoredMetricsToHaveData = async (timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    await this.waitUntilQanStoredMetricsLoaded();
    await expect(
      this.elements.firstRow,
      'Query Analytics does not have data for selected parameters!',
    ).toBeVisible({
      timeout: timeout,
    });
  };

  waitUntilQanStoredMetricsLoaded = async () => {
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: 30_000 });
  };
}
