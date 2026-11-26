import pmmTest from '@fixtures/pmmTest';
import QanApi from '@api/qan.api';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ context, grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
  await qanStoredMetrics.waitForLoad();
});

pmmTest(
  'PMM-T2376 - Open the QAN Dashboard and check that changing the time range resets current page to the first @qan',
  async ({ leftNavigation, page, qanStoredMetrics }) => {
    await qanStoredMetrics.builders.paginationItem('2').click({ timeout: Timeouts.ONE_MINUTE });
    await expect(page).toHaveURL(/page_number=2/);
    await leftNavigation.selectTimeRange('Last 3 hours');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.verifyActivePage(1, '1-25');
  },
);

pmmTest(
  'PMM-T167 - Open the QAN Dashboard and check that changing the time range updates the overview table, URL @qan',
  async ({ leftNavigation, page, qanStoredMetrics }) => {
    await expect(page).toHaveURL(/from=now-5m&to=now/);
    await qanStoredMetrics.selectRow(1);
    await leftNavigation.selectTimeRange('Last 3 hours');
    await qanStoredMetrics.waitForLoad();
    await expect(page).toHaveURL(/from=now-3h&to=now/);
    await qanStoredMetrics.selectRow(1);
  },
);

pmmTest(
  'PMM-T432 - Open the QAN Dashboard and check that changing absolute time range updates the overview table, URL @qan',
  async ({ leftNavigation, page, qanStoredMetrics }) => {
    const date = new Date().toLocaleDateString('sv-SE');

    await qanStoredMetrics.selectRow(1);
    await leftNavigation.selectTimeZone('Coordinated Universal Time');
    await leftNavigation.setAbsoluteTimeRange(`${date} 00:00:00`, `${date} 23:59:59`);
    await qanStoredMetrics.waitForLoad();
    await leftNavigation.verifySelectedTimeRange(`${date} 00:00:00`, `${date} 23:59:59`);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('from'), { message: 'From Date is not correct' })
      .toBe(`${date}T00:00:00.000Z`);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('to'), { message: 'To Date is not correct' })
      .toBe(`${date}T23:59:59.000Z`);
  },
);

pmmTest(
  'PMM-T170 - Open the QAN Dashboard and check that changing the time range doesn\'t clear "Group by" @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    const group = 'Client Host';

    await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Query', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await qanStoredMetrics.changeMainMetric(group);
    await expect(qanStoredMetrics.elements.selectedMainMetric).toHaveText(group, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await leftNavigation.selectTimeRange('Last 24 hours');
    await qanStoredMetrics.waitForLoad();
    await expect(
      qanStoredMetrics.elements.selectedMainMetric,
      `Main metric should stay "${group}" after changing the time range`,
    ).toHaveText(group);
  },
);

pmmTest(
  'PMM-T1138 - Verify QAN Copy Button for URL @qan',
  async ({ page, qanStoredMetrics, queryAnalytics, urlHelper }) => {
    const navigatedAt = Date.now();

    await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-12h', to: 'now' }));
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.selectRow(2);

    const loadedAt = Date.now();
    const firstUrl = await queryAnalytics.copyLink();
    const firstTo = Number(new URL(firstUrl).searchParams.get('to'));

    expect(
      firstTo,
      'First copied time must be one minute before navigation started or later',
    ).toBeGreaterThanOrEqual(navigatedAt - Timeouts.ONE_MINUTE - Timeouts.ONE_SECOND);
    expect(
      firstTo,
      'First copied time must be one minute before the page loaded or earlier',
    ).toBeLessThanOrEqual(loadedAt - Timeouts.ONE_MINUTE);

    // eslint-disable-next-line playwright/no-wait-for-timeout -- the stimulus: wall-clock time must pass for the copied "to" to move.
    await page.waitForTimeout(Timeouts.THIRTY_SECONDS);
    await page.reload();
    await qanStoredMetrics.waitForLoad();

    const secondTo = Number(new URL(await queryAnalytics.copyLink()).searchParams.get('to'));

    await expect(qanStoredMetrics.elements.selectedRowQueryText).not.toBeEmpty({
      timeout: Timeouts.ONE_MINUTE,
    });

    const queryText = (await qanStoredMetrics.elements.selectedRowQueryText.textContent()) ?? '';

    expect(
      Math.abs(firstTo - secondTo),
      'Difference between first and second copied time must be less than two minutes',
    ).toBeLessThan(Timeouts.TWO_MINUTES);
    expect(secondTo, 'Second copied time must not be the same as the first').not.toBe(firstTo);

    const { storedMetrics } = await qanStoredMetrics.openInNewTab(firstUrl);

    await expect(
      storedMetrics.elements.selectedRowQueryText,
      'Selected row query text is not the same after reload',
    ).toHaveText(queryText, { timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T1140 - Verify relative time range copy URL from browser @qan',
  async ({ page, qanStoredMetrics }) => {
    const url = new URL(page.url());

    // eslint-disable-next-line playwright/no-wait-for-timeout -- the stimulus: wall-clock time must pass before the URL is reopened.
    await page.waitForTimeout(Timeouts.ONE_MINUTE);

    const { page: newPage } = await qanStoredMetrics.openInNewTab(url.toString());

    for (const parameter of ['from', 'to']) {
      expect(url.searchParams.get(parameter), `The first tab URL must carry "${parameter}"`).toMatch(/\S/);
      await expect
        .poll(() => new URL(newPage.url()).searchParams.get(parameter), {
          message: `The time range "${parameter}" must be the same as in the previous tab`,
        })
        .toBe(url.searchParams.get(parameter));
    }
  },
);

pmmTest(
  'PMM-T1141 - Verify specific time range by new button to copy QAN URL @qan',
  async ({ leftNavigation, page, qanStoredMetrics, queryAnalytics }) => {
    const toDate = new Date();

    toDate.setMilliseconds(0);

    const fromDate = new Date(toDate.getTime() - Timeouts.SIXTY_MINUTES);
    const from = fromDate.toLocaleString('sv-SE');
    const to = toDate.toLocaleString('sv-SE');
    const times = [
      ['from', fromDate],
      ['to', toDate],
    ] as const;

    await leftNavigation.setAbsoluteTimeRange(from, to);
    await qanStoredMetrics.waitForLoad();

    for (const [parameter, date] of times) {
      await expect
        .poll(() => new URL(page.url()).searchParams.get(parameter), {
          message: `Url does not contain selected ${parameter} date time`,
        })
        .toBe(date.toISOString());
    }

    await page.goto(await queryAnalytics.copyLink());
    await qanStoredMetrics.waitForLoad();

    const secondUrl = new URL(page.url());

    await leftNavigation.verifySelectedTimeRange(from, to);

    for (const [parameter, date] of times) {
      const value = secondUrl.searchParams.get(parameter) ?? '';
      const time = /^\d+$/.test(value) ? Number(value) : Date.parse(value);

      expect(
        Math.abs(time - date.getTime()),
        `Second Url does not contain selected ${parameter} date time`,
      ).toBeLessThan(Timeouts.ONE_SECOND);
    }
  },
);

pmmTest(
  'PMM-T1142 - Verify that the table page and selected query are still the same when we go on copied link by new QAN CopyButton @qan',
  async ({ page, qanStoredMetrics, queryAnalytics, urlHelper }) => {
    let attempt = 0;

    await page.goto(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-30m', to: 'now-5m' }),
    );
    await expect(async () => {
      if (attempt++) await page.reload();

      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.buttons.nextPage.click({ timeout: Timeouts.THIRTY_SECONDS });
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.verifyActivePage(2);
    await qanStoredMetrics.selectRow(2);
    await expect(qanStoredMetrics.builders.queryRowQueryText(2)).not.toBeEmpty();

    const queryText = (await qanStoredMetrics.builders.queryRowQueryText(2).textContent()) ?? '';
    const url = await queryAnalytics.copyLink();

    expect(new URL(url).searchParams.get('page_number'), 'Expected the Url to contain selected page').toBe(
      '2',
    );

    const { storedMetrics } = await qanStoredMetrics.openInNewTab(url);

    await storedMetrics.verifyActivePage(2);
    await expect(
      storedMetrics.elements.selectedRowQueryText,
      'Selected row query text is not the same after reload',
    ).toHaveText(queryText, { timeout: Timeouts.TWENTY_SECONDS });
    await expect(storedMetrics.buttons.closeDetails).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T1143 - Verify columns and filters when we go on copied link by new QAN CopyButton @qan',
  async ({ page, qanStoredMetrics, queryAnalytics }) => {
    const environmentName = 'pxc-dev';
    const columnName = 'Bytes Sent';
    let attempt = 0;

    await qanStoredMetrics.addColumn(columnName);
    await expect(async () => {
      if (attempt++) await page.reload();

      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectFilter(
        environmentName,
        qanStoredMetrics.builders.filterCheckboxInGroup(environmentName, 'Environment'),
      );
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.waitForLoad();

    const { page: newPage, storedMetrics } = await qanStoredMetrics.openInNewTab(
      await queryAnalytics.copyLink(),
    );

    await expect(newPage).toHaveURL(/environment=pxc-dev/);
    await expect(storedMetrics.elements.checkedFilterLabels).toHaveText([environmentName], {
      timeout: Timeouts.ONE_MINUTE,
    });
    await expect(storedMetrics.builders.columnHeader(columnName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T2897 - Verify Query Analytics loads queries and query details for a time range inside one minute @qan',
  async ({ api, leftNavigation, page, qanStoredMetrics }) => {
    const minute = await pmmTest.step('Find a minute about 5 minutes ago that holds queries', async () => {
      let timestamp = 0;

      await expect(async () => {
        const now = Date.now();
        const { body, status, text } = await api.qanApi.getTotals(undefined, {
          period_start_from: new Date(now - Timeouts.FIFTEEN_MINUTES).toISOString(),
          period_start_to: new Date(now).toISOString(),
        });

        expect(status, text).toBe(200);
        timestamp =
          (body.sparkline ?? [])
            .filter(({ load }) => load)
            .map(({ timestamp }) => Date.parse(timestamp))
            .filter((time) => time <= now - Timeouts.FIVE_MINUTES + Timeouts.ONE_MINUTE)
            .sort((a, b) => b - a)[0] ?? 0;
        expect(timestamp, 'A minute 4 to 15 minutes ago must hold queries').toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.THIRTY_SECONDS], timeout: Timeouts.FIVE_MINUTES });

      return new Date(timestamp).toISOString().slice(0, 16);
    });

    await pmmTest.step('Set the time zone to UTC', async () => {
      await leftNavigation.selectTimeZone('Coordinated Universal Time');
      await expect(leftNavigation.elements.timePickerOpenButton).toContainText('UTC');
    });

    await pmmTest.step('Set a time range from second 0 to second 50 of that minute', async () => {
      await leftNavigation.setAbsoluteTimeRange(
        `${minute.replace('T', ' ')}:00`,
        `${minute.replace('T', ' ')}:50`,
      );
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get('from') === `${minute}:00.000Z` &&
          url.searchParams.get('to') === `${minute}:50.000Z`,
      );
      await qanStoredMetrics.waitForLoad();
      await expect(qanStoredMetrics.builders.queryRow(0)).toContainText('TOTAL');
      await expect(qanStoredMetrics.elements.firstRow).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(qanStoredMetrics.elements.noData).toBeHidden();
      await expect(qanStoredMetrics.messages.notification).toBeHidden();
    });

    await pmmTest.step('Select the first query and read its Query Count', async () => {
      await qanStoredMetrics.selectRow(1);
      await expect(qanStoredMetrics.builders.detailMetricValue('Query Count', 3)).toHaveText(/\d/, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    expect(await api.serverApi.getLog('qan-api2.log')).not.toContain('integer divide by zero');
  },
);

pmmTest(
  'PMM-T2898 - Verify Query Analytics refuses a time range that ends before it starts @qan',
  async ({ api }) => {
    const minute = new Date(Date.now() - Timeouts.FIVE_MINUTES).toISOString().slice(0, 16);
    const reversedMinute = { period_start_from: `${minute}:50Z`, period_start_to: `${minute}:10Z` };
    const reversedError = 'cannot be later then to-date';
    let queryId = '';

    await expect(async () => {
      const { body } = await api.qanApi.getReport(undefined, QanApi.period(1));

      queryId = (body.rows ?? []).find(({ dimension }) => dimension)?.dimension ?? '';
      expect(queryId, 'The last hour must hold at least one query').not.toBe('');
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });

    const reversedReport = await api.qanApi.getReport(undefined, reversedMinute, {
      columns: ['load'],
      limit: 10,
    });

    expect(reversedReport.status, reversedReport.text).toBe(400);
    expect(reversedReport.text).toContain(reversedError);

    const reversedDetails = await api.qanApi.getMetrics(undefined, queryId, reversedMinute);

    expect(reversedDetails.status, reversedDetails.text).toBe(400);

    const now = Date.now();
    const reversedHour = await api.qanApi.getTotals(undefined, {
      period_start_from: new Date(now).toISOString(),
      period_start_to: new Date(now - Timeouts.SIXTY_MINUTES).toISOString(),
    });

    expect(reversedHour.status, reversedHour.text).toBe(400);
    expect(reversedHour.body, 'A refused request must return no data point').not.toHaveProperty('sparkline');

    const reversedFilters = await api.qanApi.getFilters(undefined, reversedMinute);

    expect(reversedFilters.status, reversedFilters.text).toBe(400);
    expect(await api.serverApi.getLog('qan-api2.log')).not.toContain('integer divide by zero');
  },
);
