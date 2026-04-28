import { expect } from '@playwright/test';
import { AccessServiceType } from '@interfaces/accessControl';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

const serviceTypes: AccessServiceType[] = ['mongodb', 'mysql', 'postgresql'];

export default class StoredMetricsPage extends BasePage {
  readonly url = 'graph/d/pmm-qan/pmm-query-analytics';
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

  verifyOnlyServiceTypeVisible = async (expected: AccessServiceType) => {
    await expect(this.page.getByRole('heading', { name: 'Query Analytics' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByRole('progressbar')).toBeHidden({ timeout: 120_000 });
    await expect(this.page.locator('iframe').first()).toBeVisible({ timeout: 60_000 });

    const serviceTypeHeader = this.grafanaIframe()
      .getByTestId('checkbox-group-header')
      .getByText('Service Type', { exact: true });

    await expect(serviceTypeHeader).toBeVisible({ timeout: 60_000 });

    const sectionText = ((await serviceTypeHeader.textContent()) ?? '').trim();
    const disallowedServiceTypes = serviceTypes.filter((value) => value !== expected);

    expect(sectionText).toContain(expected);

    for (const serviceType of disallowedServiceTypes) {
      expect(sectionText).not.toContain(serviceType);
    }
  };

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

    const noDataLocator = this.elements.noData;
    const timeoutInSeconds = timeout / 1_000;

    for (let i = 0; i < timeoutInSeconds; i++) {
      // eslint-disable-next-line playwright/no-wait-for-timeout -- TODO: Replace with a better approach
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);

      if (!(await noDataLocator.isVisible())) return;
    }

    await expect(noDataLocator).not.toBeVisible({
      timeout: Timeouts.ONE_SECOND,
    });
  };

  waitUntilQanStoredMetricsLoaded = async () => {
    await expect(this.elements.spinner.first()).toBeHidden({ timeout: 30_000 });
  };
}
