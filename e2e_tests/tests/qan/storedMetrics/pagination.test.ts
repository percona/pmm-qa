import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-60m', to: 'now' }));
  await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.ONE_MINUTE);
});

pmmTest('PMM-T128 - Verify qanPagination works correctly @qan', async ({ qanStoredMetrics }) => {
  await expect(qanStoredMetrics.elements.resultsPerPage).toHaveText('25 / page', {
    timeout: Timeouts.THIRTY_SECONDS,
  });

  const countOfItems = await qanStoredMetrics.getQueryCount();

  await expect(qanStoredMetrics.buttons.previousPage).toHaveAttribute('aria-disabled', 'true');
  await qanStoredMetrics.buttons.nextPage.click();
  await qanStoredMetrics.verifyActivePage(2, countOfItems <= 50 ? `26-${countOfItems}` : '26-50');

  if (countOfItems > 50) {
    await qanStoredMetrics.buttons.previousPage.click();
    await qanStoredMetrics.verifyActivePage(1, '1-25');
  }
  if (countOfItems > 175) {
    await expect(qanStoredMetrics.buttons.previousPage).toHaveAttribute('aria-disabled', 'true');
    await qanStoredMetrics.builders.paginationItem('Next 5 Pages').click();
    await qanStoredMetrics.verifyActivePage(6, '126-150');
    await qanStoredMetrics.builders.paginationItem('Previous 5 Pages').click();
    await qanStoredMetrics.verifyActivePage(1, '1-25');
    await qanStoredMetrics.builders.paginationItem('3').click();
    await qanStoredMetrics.verifyActivePage(3, '51-75');
  }
});

pmmTest(
  'PMM-T193 + PMM-T256 - Verify per-page selection updates pagination and switching from 25 to 50/100 works @qan',
  async ({ qanStoredMetrics }) => {
    const countOfItems = await qanStoredMetrics.getQueryCount();

    await expect(qanStoredMetrics.elements.queryRows.visible()).toHaveCount(26, {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.verifyPaginationRange('1-25');
    await qanStoredMetrics.verifyPagesAndCount(25);

    if (countOfItems > 50) {
      await qanStoredMetrics.selectResultsPerPage('50 / page');
      await expect(qanStoredMetrics.elements.queryRows.visible()).toHaveCount(51, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await qanStoredMetrics.verifyPagesAndCount(50);
      await qanStoredMetrics.verifyPaginationRange('1-50');
      await qanStoredMetrics.selectResultsPerPage('100 / page');
      await expect(qanStoredMetrics.elements.queryRows.visible()).toHaveCount(
        Math.min(countOfItems, 100) + 1,
        {
          timeout: Timeouts.THIRTY_SECONDS,
        },
      );
      await qanStoredMetrics.verifyPagesAndCount(100);
      await qanStoredMetrics.verifyPaginationRange(`1-${Math.min(countOfItems, 100)}`);
    }
    if (countOfItems > 125) {
      await qanStoredMetrics.selectResultsPerPage('25 / page');
      await expect(qanStoredMetrics.elements.queryRows.visible()).toHaveCount(26, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await qanStoredMetrics.verifyPaginationRange('1-25');
      await qanStoredMetrics.verifyPagesAndCount(25);
    }
  },
);
