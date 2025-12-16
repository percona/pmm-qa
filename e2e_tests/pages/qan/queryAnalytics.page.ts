import { expect, Page } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

export default class QueryAnalytics extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    noData: '//*[@data-testid="table-no-data"]',
    spinner: '//*[@data-testid="Spinner"]',
    totalCount: '//*[@data-testid="qan-total-items"]',
    firstRow: '//*[@role="row" and @class="tr tr-1"]',
  };

  url = 'graph/d/pmm-qan/pmm-query-analytics';

  waitUntilQueryAnalyticsLoaded = async () => {
    await expect(this.page.locator(this.elements.spinner).first()).toBeHidden({ timeout: 30000 });
  };

  waitForQueryAnalyticsToHaveData = async (timeout: Timeouts = Timeouts.ONE_MINUTE) => {
    await this.waitUntilQueryAnalyticsLoaded();
    const noDataLocator = this.page.locator(this.elements.noData);
    const timeoutInSeconds = timeout / 1000;

    for (let i = 0; i < timeoutInSeconds; i++) {
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
      if (!(await noDataLocator.isVisible())) {
        return;
      }
    }

    await expect(noDataLocator).not.toBeVisible({
      timeout: Timeouts.ONE_SECOND,
    });
  };

  verifyQueryAnalyticsHaveData = async () => {
    await this.waitUntilQueryAnalyticsLoaded();
    await expect(this.page.locator(this.elements.noData)).toBeHidden({ timeout: 30000 });
    await expect(this.page.locator(this.elements.firstRow)).toBeVisible({ timeout: 30000 });
  };

  verifyTotalQueryCount = async (expectedQueryCount: number) => {
    const countString = await this.page.locator(this.elements.totalCount).first().textContent();

    if (!countString) {
      throw new Error('Count of queries is not displayed!');
    }

    const match = countString.match(/of (\d+) items/);
    const queryCount = match ? parseInt(match[1], 10) : null;

    expect(queryCount).toEqual(expectedQueryCount);
  };
}
