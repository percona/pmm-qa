import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import StoredMetricsPage from '@pages/qan/storedMetrics/storedMetrics.page';
import { expect } from '@playwright/test';

// Below QAN's own default of 25, so a second page exists for the amount of query
// digests a freshly provisioned environment has actually collected by test time.
const PAGE_SIZE = 10;

pmmTest.beforeEach(async ({ grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();
  await page.goto(`${queryAnalytics.url}?page_size=${PAGE_SIZE}`);
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

    await pmmTest.step('Apply service type filter', async () => {
      await mongoDbLabel.scrollIntoViewIfNeeded();
      await mongoDbLabel.click();
    });

    await pmmTest.step('Change pagination', async () => {
      await expect
        .poll(async () => storedMetrics.getTotalQueryCount(), {
          message: `QAN needs more than one page of ${PAGE_SIZE} mongodb queries to exercise pagination`,
          timeout: Timeouts.THIRTY_SECONDS,
        })
        .toBeGreaterThan(PAGE_SIZE);

      const secondPaginationItem = storedMetrics.builders.paginationItem('2');

      await expect(secondPaginationItem).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await secondPaginationItem.click();
    });

    await pmmTest.step('Exercise filter changes', async () => {
      for (let index = 0; index < 4; index++) {
        await mongoDbLabel.click();
      }
    });

    await pmmTest.step('Exercise pagination changes', async () => {
      for (const pageNumber of ['1', '2', '1', '2']) {
        await storedMetrics.builders.paginationItem(pageNumber).click();
      }
    });

    await pmmTest.step('Exercise search filter changes', async () => {
      for (const value of ['a', 'ab', 'abc', '']) {
        await storedMetrics.inputs.search.fill(value);
      }

      // eslint-disable-next-line playwright/no-wait-for-timeout -- allow debounce and console errors to settle
      await page.waitForTimeout(Timeouts.HALF_SECOND);
    });

    await pmmTest.step('Verify state in the URL', async () => {
      await expect.poll(() => new URL(page.url()).searchParams.has('dimensionSearchText')).toBeFalsy();
      await expect.poll(() => new URL(page.url()).searchParams.get('page_number')).toBe('2');
      await expect.poll(() => new URL(page.url()).searchParams.get('page_size')).toBe(String(PAGE_SIZE));
      await expect
        .poll(() => new URL(page.url()).searchParams.getAll('var-service_type'))
        .toContain('mongodb');
    });

    await pmmTest.step('Verify shared URL restores state', async () => {
      const sharedPage = await context.newPage();

      await sharedPage.goto(page.url());

      const sharedStoredMetrics = new StoredMetricsPage(sharedPage);

      await expect(sharedStoredMetrics.builders.serviceTypeFilter('mongodb')).toBeChecked({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(sharedStoredMetrics.builders.paginationItem('2')).toHaveClass(
        /ant-pagination-item-active/,
      );
    });

    const errors = (await page.consoleMessages()).filter((message) => message.type() === 'error');

    expect(errors).toEqual([]);
  },
);
