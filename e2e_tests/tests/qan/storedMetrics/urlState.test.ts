import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import StoredMetricsPage from '@pages/qan/storedMetrics/storedMetrics.page';
import { expect, type ConsoleMessage } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();
  await page.goto(queryAnalytics.url);
  await queryAnalytics.storedMetrics.elements.iframe.waitFor({
    state: 'visible',
    timeout: Timeouts.THIRTY_SECONDS,
  });
});

pmmTest(
  'PMM-T2268 Verify QAN shared URL restores filters and pagination @rta',
  async ({ context, page, queryAnalytics }) => {
    const { storedMetrics } = queryAnalytics;
    const mongoDbLabel = storedMetrics.builders.serviceTypeLabel('mongodb');
    const errors: string[] = [];

    const collectErrors = (message: ConsoleMessage) => {
      if (message.type() === 'error') errors.push(message.text());
    };

    page.on('console', collectErrors);
    await mongoDbLabel.scrollIntoViewIfNeeded();
    await mongoDbLabel.click();

    const secondPaginationItem = storedMetrics.builders.paginationItem('2');

    await expect(secondPaginationItem).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await secondPaginationItem.click();

    for (let index = 0; index < 4; index++) {
      await mongoDbLabel.click();
    }

    for (const pageNumber of ['1', '2', '1', '2']) {
      await storedMetrics.builders.paginationItem(pageNumber).click();
    }

    for (const value of ['a', 'ab', 'abc', '']) {
      await storedMetrics.inputs.search.fill(value);
    }

    // eslint-disable-next-line playwright/no-wait-for-timeout -- allow debounce and console errors to settle
    await page.waitForTimeout(Timeouts.HALF_SECOND);

    await expect.poll(() => new URL(page.url()).searchParams.has('dimensionSearchText')).toBeFalsy();
    await expect.poll(() => new URL(page.url()).searchParams.get('page_number')).toBe('2');
    await expect.poll(() => new URL(page.url()).searchParams.getAll('var-service_type')).toContain('mongodb');

    const sharedUrl = page.url();
    const sharedPage = await context.newPage();

    await sharedPage.goto(sharedUrl);

    const sharedStoredMetrics = new StoredMetricsPage(sharedPage);

    await expect(sharedStoredMetrics.builders.serviceTypeFilter('mongodb')).toBeChecked({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(sharedStoredMetrics.builders.paginationItem('2')).toHaveClass(/ant-pagination-item-active/);

    page.off('console', collectErrors);
    expect(errors).toEqual([]);
    await sharedPage.close();
  },
);
