const moment = require('moment');
const assert = require('assert');

Feature('QAN timerange').retry(1);

Before(async ({ I, queryAnalyticsPage, codeceptjsConfig }) => {
  await I.usePlaywrightTo('Grant Permissions', async ({ browserContext }) => {
    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: codeceptjsConfig.config.helpers.Playwright.url,
    });
  });
  await I.usePlaywrightTo('Mock BE Responses', async ({ page }) => {
    await page.route('**/v1/users/me', (route) => route.fulfill({
      status: 200,
      body: JSON.stringify({
        user_id: 1,
        product_tour_completed: true,
        alerting_tour_completed: true,
        snoozed_pmm_version: '',
      }),
    }));

    await page.route('**/v1/server/updates?force=**', (route) => route.fulfill({
      status: 200,
      body: JSON.stringify({
        installed: {},
        latest: {},
        update_available: false,
      }),
    }));
  });

  await I.Authorize();
  I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
  queryAnalyticsPage.waitForLoaded();
});

Scenario(
  'Open the QAN Dashboard and check that changing the time range resets current page to the first. @qan',
  async ({ adminPage, queryAnalyticsPage }) => {
    queryAnalyticsPage.data.selectPage('2');
    await adminPage.applyTimeRange('Last 3 hours');
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.verifyActivePage(1);
  },
);

Scenario(
  'PMM-T167 Open the QAN Dashboard and check that changing the time range updates the overview table, URL @qan',
  async ({
    I, adminPage, queryAnalyticsPage,
  }) => {
    I.seeInCurrentUrl('from=now-5m&to=now');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    I.seeElement(queryAnalyticsPage.data.root);

    await adminPage.applyTimeRange('Last 3 hours');
    queryAnalyticsPage.waitForLoaded();
    I.seeInCurrentUrl('from=now-3h&to=now');
    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    I.seeElement(queryAnalyticsPage.data.root);
  },
);

Scenario(
  'PMM-T432 Open the QAN Dashboard and check that changing absolute time range updates the overview table, URL @qan',
  async ({
    I, adminPage, queryAnalyticsPage,
  }) => {
    const currentDate = moment();
    const date = currentDate.format('YYYY-MM-DD');

    queryAnalyticsPage.data.selectRow(1);
    queryAnalyticsPage.waitForLoaded();
    adminPage.applyTimeZone('Coordinated Universal Time');
    adminPage.setAbsoluteTimeRange(`${date} 00:00:00`, `${date} 23:59:59`);
    queryAnalyticsPage.waitForLoaded();
    adminPage.verifySelectedTimeRange(`${date} 00:00:00`, `${date} 23:59:59`);

    const url = await I.grabCurrentUrl();

    I.assertContain(url.split('from=')[1].replaceAll('%20', ' '), `${date}T00:00:00.000`, 'From Date is not correct');
    I.assertContain(url.split('to=')[1].replaceAll('%20', ' '), `${date}T23:59:59.000Z`, 'To Date is not correct');
  },
);

Scenario(
  'PMM-T170 Open the QAN Dashboard and check that changing the time range doesn\'t clear "Group by". @qan',
  async ({ I, adminPage, queryAnalyticsPage }) => {
    const group = 'Client Host';

    I.waitForText('Query', 30, queryAnalyticsPage.data.elements.selectedMainMetric());
    await queryAnalyticsPage.data.changeMainMetric(group);
    await adminPage.applyTimeRange('Last 24 hours');
    queryAnalyticsPage.waitForLoaded();
    const mainMetricsText = await I.grabTextFrom(queryAnalyticsPage.data.elements.selectedMainMetric());

    I.assertEqual(
      group,
      mainMetricsText,
      `Expected main metric ${group} and real main metric ${mainMetricsText} are not equal`,
    );
  },
);

Scenario(
  'Open the QAN Dashboard and check that changing the time range doesn\'t reset sorting. @qan',
  async ({ adminPage, queryAnalyticsPage }) => {
    queryAnalyticsPage.changeSorting(1);
    await adminPage.applyTimeRange('Last 24 hours');
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.data.verifySorting(1, 'desc');
  },
);

Scenario(
  'PMM-T1138 - Verify QAN Copy Button for URL @qan',
  async ({ I, queryAnalyticsPage }) => {
    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-12h' }));
    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.selectRow(2);

    I.click(queryAnalyticsPage.buttons.copyButton);
    I.waitForVisible(I.getSuccessPopUpLocator(), 10);

    const dateTime = moment().format('x');
    const url = new URL(await I.usePlaywrightTo('Read Clipboard', async ({ page }) => await page.evaluate(async () => navigator.clipboard.readText())));
    const toTimeFromUrl1 = url.searchParams.get('to');

    assert.ok(Math.abs(dateTime - toTimeFromUrl1) < 60000, 'Difference between moment time and first copied time must be less then one minute');

    I.wait(30);
    I.refreshPage();
    queryAnalyticsPage.waitForLoaded();

    I.waitForVisible(queryAnalyticsPage.buttons.copyButton);
    I.click(queryAnalyticsPage.buttons.copyButton);
    I.waitForVisible(I.getSuccessPopUpLocator(), 10);
    const url2 = new URL(await I.usePlaywrightTo('Read Clipboard', async ({ page }) => await page.evaluate(async () => navigator.clipboard.readText())));
    const toTimeFromUrl2 = url2.searchParams.get('to');
    const queryText = await queryAnalyticsPage.data.getSelectedRowQueryText();

    assert.ok(Math.abs(toTimeFromUrl1 - toTimeFromUrl2) < 120000, 'Difference between moment time and second copied time must be less then two minutes');
    assert.notEqual(toTimeFromUrl1, toTimeFromUrl2, 'TimeFromUrl2 must not be the same as timeFromUrl1');

    I.openNewTab();
    I.amOnPage(url.toString());
    queryAnalyticsPage.waitForLoaded();
    I.waitForVisible(queryAnalyticsPage.data.elements.selectedRow);
    const queryTextAfter = await queryAnalyticsPage.data.getSelectedRowQueryText();

    assert.equal(queryText, queryTextAfter, 'Selected row query text is not the same after reload');
  },
);

Scenario(
  'PMM-T1140 - Verify relative time range copy URL from browser @qan',
  async ({ I, queryAnalyticsPage }) => {
    const url = new URL(await I.grabCurrentUrl());
    const fromString1 = url.searchParams.get('from');
    const toString1 = url.searchParams.get('to');

    I.wait(60);
    I.openNewTab();
    I.amOnPage(url.toString());
    queryAnalyticsPage.waitForLoaded();

    const url2 = new URL(await I.grabCurrentUrl());
    const fromString2 = url2.searchParams.get('from');
    const toString2 = url2.searchParams.get('to');

    assert.equal(fromString1, fromString2, `The time range "from" ${fromString1} is NOT the same you were seeing in previously tab ${fromString2}`);
    assert.equal(toString1, toString2, `The time range "to" ${toString1} is NOT the same you were seeing in previously tab ${toString2}`);
  },
);

Scenario(
  'PMM-T1141 - Verify specific time range by new button to copy QAN URL @qan',
  async ({ I, adminPage, queryAnalyticsPage }) => {
    const dateTime = moment();
    const to = dateTime.format('YYYY-MM-DD HH:mm:ss');
    const from = moment(dateTime).subtract(1, 'hours').format('YYYY-MM-DD HH:mm:ss');

    adminPage.setAbsoluteTimeRange(from, to);
    queryAnalyticsPage.waitForLoaded();

    const url = await I.grabCurrentUrl();

    I.assertContain(url.split('from=')[1].replaceAll('%20', ' '), moment(from).toISOString(), 'Url does not contain selected from date time');
    I.assertContain(url.split('to=')[1].replaceAll('%20', ' '), moment(to).toISOString(), 'Url does not contain selected to date time');

    I.click(queryAnalyticsPage.buttons.copyButton);
    I.waitForVisible(I.getSuccessPopUpLocator(), 10);
    const clipBoardUrl = await I.usePlaywrightTo('Read Clipboard', async ({ page }) => await page.evaluate(async () => navigator.clipboard.readText()));

    I.amOnPage(clipBoardUrl);
    queryAnalyticsPage.waitForLoaded();
    const secondUrl = await I.grabCurrentUrl();

    adminPage.verifySelectedTimeRange(from, to);

    I.assertContain(secondUrl.split('from=')[1].replaceAll('%20', ' '), moment(from).utc().toISOString(), 'Second Url does not contain selected from date time');
    I.assertContain(secondUrl.split('to=')[1].replaceAll('%20', ' '), moment(to).utc().toISOString(), 'Second Url does not contain selected to date time');
  },
);

Scenario(
  'PMM-T1142 - Verify that the table page and selected query are still the same when we go on copied link by new QAN CopyButton @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    await I.waitForVisible(queryAnalyticsPage.data.buttons.nextPage);
    await I.click(queryAnalyticsPage.data.buttons.nextPage);
    await queryAnalyticsPage.data.selectRow(2);
    const queryText = await queryAnalyticsPage.data.getQueryRowQueryText(2);

    await I.click(queryAnalyticsPage.buttons.copyButton);
    await I.waitForVisible(I.getSuccessPopUpLocator(), 10);

    const url = await I.usePlaywrightTo('Read Clipboard', async ({ page }) => await page.evaluate(async () => navigator.clipboard.readText()));

    await I.openNewTab({ viewport: { width: 1920, height: 1080 } });
    await I.amOnPage(url);

    await I.assertContain(url, '&page_number=2', 'Expected the Url to contain selected page');
    await queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.data.verifyActivePage(2);
    await I.waitForVisible(queryAnalyticsPage.data.elements.selectedRow, 20);
    const queryTextAfter = await queryAnalyticsPage.data.getSelectedRowQueryText();

    assert.equal(queryText, queryTextAfter, 'Selected row query text is not the same after reload');
    await I.waitForElement(queryAnalyticsPage.data.buttons.close, 30);
  },
).retry(2);

Scenario(
  'PMM-T1143 - Verify columns and filters when we go on copied link by new QAN CopyButton @qan',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const environmentName = 'pxc-dev';
    const columnName = 'Bytes Sent';

    queryAnalyticsPage.addColumn(columnName);
    queryAnalyticsPage.filters.selectFilter(environmentName);
    queryAnalyticsPage.waitForLoaded();
    I.click(queryAnalyticsPage.buttons.copyButton);
    I.waitForVisible(I.getSuccessPopUpLocator(), 10);

    const url = await I.usePlaywrightTo('Read Clipboard', async ({ page }) => await page.evaluate(async () => navigator.clipboard.readText()));

    I.openNewTab();
    I.amOnPage(url);
    queryAnalyticsPage.waitForLoaded();
    I.seeInCurrentUrl(`environment=${environmentName}`);
    await queryAnalyticsPage.filters.verifyCheckedFilters([environmentName]);
    I.waitForElement(queryAnalyticsPage.data.fields.columnHeader(columnName), 30);
  },
);
