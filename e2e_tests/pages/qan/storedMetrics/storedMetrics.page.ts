import { expect } from '@playwright/test';
import { AccessServiceType } from '@interfaces/accessControl';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import QueryAnalyticsDetails from '@components/qan/storedMetrics/queryAnalyticsDetails.component';

const serviceTypes: AccessServiceType[] = ['mongodb', 'mysql', 'postgresql'];

export default class StoredMetricsPage extends BasePage {
  readonly url = 'graph/d/pmm-qan/pmm-query-analytics';
  qanDetails = new QueryAnalyticsDetails(this.page);
  builders = {
    serviceTypeCheckbox: (serviceType: string) =>
      this.grafanaIframe().getByTestId(`filter-checkbox-${serviceType}`),
  };
  buttons = {};
  elements = {
    firstRow: this.grafanaIframe().locator('//*[@role="row" and @class="tr tr-1"]'),
    iframe: this.page.locator('iframe').first(),
    noData: this.grafanaIframe().locator('//*[@data-testid="table-no-data"]'),
    pageProgressBar: this.page.getByRole('progressbar'),
    pageTitle: this.page.getByRole('heading', { name: 'Query Analytics' }),
    spinner: this.grafanaIframe().locator('//*[@data-testid="Spinner"]'),
    totalCount: this.grafanaIframe().locator('//*[@data-testid="qan-total-items"]'),
  };
  inputs = {};
  messages = {};

  verifyOnlyServiceTypeVisible = async (expected: AccessServiceType) => {
    await expect(this.elements.pageTitle).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await this.waitUntilQanStoredMetricsLoaded();
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
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });

    if (await this.elements.noData.isVisible()) {
      await this.page.reload();
      await expect(this.elements.spinner.first()).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    }

    await expect(this.elements.noData).toBeHidden({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.elements.firstRow).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };
}
