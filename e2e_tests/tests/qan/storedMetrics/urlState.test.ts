import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import StoredMetricsPage from '@pages/qan/storedMetrics/storedMetrics.page';
import { expect, type ConsoleMessage, type Page } from '@playwright/test';

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
    let sharedPage: Page | undefined;

    const collectErrors = (message: ConsoleMessage) => {
      if (message.type() === 'error') errors.push(message.text());
    };

    page.on('console', collectErrors);

    try {
      await pmmTest.step('Apply service type filter', async () => {
        await mongoDbLabel.scrollIntoViewIfNeeded();
        await mongoDbLabel.click();
      });

      await pmmTest.step('Change pagination', async () => {
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
        await expect
          .poll(() => new URL(page.url()).searchParams.getAll('var-service_type'))
          .toContain('mongodb');
      });

      await pmmTest.step('Verify shared URL restores state', async () => {
        sharedPage = await context.newPage();
        await sharedPage.goto(page.url());

        const sharedStoredMetrics = new StoredMetricsPage(sharedPage);

        await expect(sharedStoredMetrics.builders.serviceTypeFilter('mongodb')).toBeChecked({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(sharedStoredMetrics.builders.paginationItem('2')).toHaveClass(
          /ant-pagination-item-active/,
        );
        expect(errors).toEqual([]);
      });
    } finally {
      page.off('console', collectErrors);
      await sharedPage?.close();
    }
  },
);
