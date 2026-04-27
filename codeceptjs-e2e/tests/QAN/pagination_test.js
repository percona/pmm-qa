Feature('QAN pagination');

Before(async ({ I, queryAnalyticsPage }) => {
  await I.Authorize();
  I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
  queryAnalyticsPage.waitForLoaded();
});

Scenario(
  'PMM-T128 - Verify qanPagination works correctly @qan',
  async ({ I, queryAnalyticsPage }) => {
    await queryAnalyticsPage.data.verifySelectedCountPerPage('25 / page');
    const countOfItems = await queryAnalyticsPage.data.getCountOfItems();

    if (countOfItems <= 50) {
      I.seeAttributesOnElements(queryAnalyticsPage.data.buttons.previousPage, { 'aria-disabled': 'true' });
      I.click(queryAnalyticsPage.data.buttons.nextPage);
      await queryAnalyticsPage.data.verifyActivePage(2);
      await queryAnalyticsPage.data.verifyPaginationRange(`26-${countOfItems}`);
    } else if (countOfItems <= 125 && countOfItems > 50) {
      I.seeAttributesOnElements(queryAnalyticsPage.data.buttons.previousPage, { 'aria-disabled': 'true' });
      I.click(queryAnalyticsPage.data.buttons.nextPage);
      await queryAnalyticsPage.data.verifyActivePage(2);
      await queryAnalyticsPage.data.verifyPaginationRange('26-50');
      I.click(queryAnalyticsPage.data.buttons.previousPage);
      await queryAnalyticsPage.data.verifyActivePage(1);
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
    } else {
      I.seeAttributesOnElements(queryAnalyticsPage.data.buttons.previousPage, { 'aria-disabled': 'true' });
      I.click(queryAnalyticsPage.data.buttons.nextPage);
      await queryAnalyticsPage.data.verifyActivePage(2);
      await queryAnalyticsPage.data.verifyPaginationRange('26-50');
      I.click(queryAnalyticsPage.data.buttons.previousPage);
      await queryAnalyticsPage.data.verifyActivePage(1);
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      I.seeAttributesOnElements(queryAnalyticsPage.data.buttons.previousPage, { 'aria-disabled': 'true' });
      I.click(queryAnalyticsPage.data.buttons.ellipsis);
      await queryAnalyticsPage.data.verifyActivePage(6);
      await queryAnalyticsPage.data.verifyPaginationRange('126-150');
      I.click(queryAnalyticsPage.data.buttons.ellipsis);
      await queryAnalyticsPage.data.verifyActivePage(1);
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      I.click(queryAnalyticsPage.data.buttons.paginationPage(3));
      await queryAnalyticsPage.data.verifyActivePage(3);
      await queryAnalyticsPage.data.verifyPaginationRange('51-75');
    }
  },
);

Scenario(
  'PMM-T193 - Verify user is able to change per page elements display and qanPagination is updated according to this value, PMM-T256 - Verify that switching view from 25 to 50/100 pages works correctly @qan',
  async ({ queryAnalyticsPage }) => {
    const countOfItems = await queryAnalyticsPage.data.getCountOfItems();

    await queryAnalyticsPage.data.verifyRowCount(26);
    if (countOfItems <= 50) {
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      await queryAnalyticsPage.data.verifyPagesAndCount(25);
    } else if (countOfItems <= 125 && countOfItems > 50) {
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      await queryAnalyticsPage.data.verifyPagesAndCount(25);
      await queryAnalyticsPage.data.selectResultsPerPage('50 / page');
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.data.verifyRowCount(51);
      await queryAnalyticsPage.data.verifyPagesAndCount(50);
      await queryAnalyticsPage.data.verifyPaginationRange('1-50');
      await queryAnalyticsPage.data.selectResultsPerPage('100 / page');
      if (countOfItems === 100) await queryAnalyticsPage.data.verifyPaginationRange('1-100');
    } else {
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      await queryAnalyticsPage.data.verifyPagesAndCount(25);
      await queryAnalyticsPage.data.selectResultsPerPage('50 / page');
      await queryAnalyticsPage.data.verifyRowCount(51);
      await queryAnalyticsPage.data.verifyPagesAndCount(50);
      await queryAnalyticsPage.data.verifyPaginationRange('1-50');
      await queryAnalyticsPage.data.selectResultsPerPage('100 / page');
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.data.verifyRowCount(101);
      await queryAnalyticsPage.data.verifyPagesAndCount(100);
      await queryAnalyticsPage.data.verifyPaginationRange('1-100');
      await queryAnalyticsPage.data.selectResultsPerPage('25 / page');
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.data.verifyRowCount(26);
      await queryAnalyticsPage.data.verifyPaginationRange('1-25');
      await queryAnalyticsPage.data.verifyPagesAndCount(25);
    }
  },
);
