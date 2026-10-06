import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-30m', to: 'now' }));
});

pmmTest('PMM-T269 - Verify QAN UI Elements are displayed @qan', async ({ api, qanStoredMetrics }) => {
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await expect(qanStoredMetrics.elements.addColumnButton).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await expect(qanStoredMetrics.elements.queryRows.visible()).toHaveCount(26, {
    timeout: Timeouts.THIRTY_SECONDS,
  });
  await expect
    .poll(
      async () =>
        Math.ceil(
          ((await qanStoredMetrics.getTotalQueryCount()) ?? 0) /
            Number(await qanStoredMetrics.buttons.lastPage.getAttribute('title')) /
            25,
        ) * 25,
      { message: 'Pages do not match with total count' },
    )
    .toBe(25);

  for (const filter of [
    'Environment',
    'Cluster',
    'Replication Set',
    'Database',
    'Node Name',
    'Service Name',
    'User Name',
    'Node Type',
    'Service Type',
    'Command Type',
  ]) {
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await qanStoredMetrics.expandFilterGroup(filter);

    const checkboxes = qanStoredMetrics.builders.filterCheckboxesInGroup(filter);
    const countFilters = await checkboxes.visible().count();

    if (countFilters === 0 || filter === 'Service Name') continue;

    const position = Math.floor(Math.random() * countFilters);

    await checkboxes.nth(position).click();
    await expect(async () => {
      await qanStoredMetrics.refreshIfNoQueries();
      await expect(
        qanStoredMetrics.builders.queryRow(1),
        `No values for filter: "${filter}" were displayed`,
      ).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    }).toPass({ timeout: Timeouts.TWO_MINUTES });
    await checkboxes.nth(position).click();
  }

  const { services } = await api.inventoryApi.getServices();

  await qanStoredMetrics.expandFilterGroup('Service Name');
  await expect(
    qanStoredMetrics.builders.filterLabelsInGroup('Service Name'),
    'No Service Name filters found for node "pmm-server"',
  ).not.toHaveCount(0);

  const serviceLabels = await qanStoredMetrics.builders.filterLabelsInGroup('Service Name').allTextContents();
  const serverServiceNames = services
    .filter((service) => service.node_name === 'pmm-server')
    .map((service) => service.service_name);
  const serviceFilter =
    serviceLabels.find((label) =>
      serverServiceNames.some((name) => label.includes(name) || name.includes(label)),
    ) ||
    serviceLabels.find((label) => label.includes('pmm-server')) ||
    serviceLabels[0];

  await qanStoredMetrics.selectFilter(
    serviceFilter,
    qanStoredMetrics.builders.filterCheckboxInGroup(serviceFilter, 'Service Name'),
  );
  await qanStoredMetrics.buttons.showSelected.click({ timeout: Timeouts.THIRTY_SECONDS });
  await expect(
    qanStoredMetrics.elements.checkedFilterLabels.first(),
    `Displayed filter value does not contain expected value: "${serviceFilter}"`,
  ).toContainText(serviceFilter);
  await expect(async () => {
    await qanStoredMetrics.refreshIfNoQueries();
    await expect(
      qanStoredMetrics.builders.queryRow(1),
      `No QAN rows displayed after filtering by ${serviceFilter}`,
    ).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  }).toPass({ timeout: Timeouts.TWO_MINUTES });
});

pmmTest(
  'PMM-T186 - Verify values in overview and in details match @qan',
  async ({ leftNavigation, page, qanStoredMetrics }) => {
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await leftNavigation.selectTimeRange('Last 1 hour');
    await expect(async () => {
      await page.reload();
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await qanStoredMetrics.selectFilter(
        'pxc-dev',
        qanStoredMetrics.builders.serviceTypeCheckbox('pxc-dev'),
      );
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.searchByValue('insert');
    await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.builders.queryRow(1).click();
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.elements.selectedRow).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
    await expect(qanStoredMetrics.builders.detailMetricValue('Query Time', 3)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      qanStoredMetrics.builders.detailMetricValue('Query Count', 2),
      'Query Count value in Overview and Detail should match',
    ).toHaveText((await qanStoredMetrics.builders.queryValue(1, 2).textContent()) ?? '', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(
      qanStoredMetrics.builders.detailMetricValue('Query Time', 4),
      'Query Time value in Overview and Detail should match',
    ).toHaveText((await qanStoredMetrics.builders.queryValue(1, 3).textContent()) ?? '', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T215 - Verify that buttons in QAN are disabled and visible on the screen @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.buttons.previousPage).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await expect(qanStoredMetrics.buttons.previousPage).toHaveAttribute('aria-disabled', 'true');
    await expect(qanStoredMetrics.buttons.nextPage).toHaveAttribute('aria-disabled', 'false');
    await expect(qanStoredMetrics.buttons.resetAll).toBeDisabled();
    await expect(qanStoredMetrics.buttons.showSelected).toBeDisabled();
    await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    if (Number(await qanStoredMetrics.buttons.lastPage.getAttribute('title')) > 7) {
      await expect(qanStoredMetrics.buttons.ellipsis).toBeVisible();
    }
  },
);

pmmTest('PMM-T188 - Verify dashboard refresh @qan', async ({ leftNavigation, qanStoredMetrics }) => {
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await qanStoredMetrics.changeMainMetric('Database');
  await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Database', {
    timeout: Timeouts.TEN_SECONDS,
  });
  await expect(qanStoredMetrics.builders.sortControl(2)).toBeAttached({ timeout: Timeouts.THIRTY_SECONDS });
  await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
  await qanStoredMetrics.builders.sortControl(2).dispatchEvent('click');
  await qanStoredMetrics.selectFilter(
    'postgres',
    qanStoredMetrics.builders.filterCheckboxInGroup('postgres', 'Database'),
  );
  await qanStoredMetrics.addColumn('Bytes Sent');
  await leftNavigation.selectTimeRange('Last 1 hour');
  await qanStoredMetrics.searchByValue('postgres');
  await qanStoredMetrics.builders.queryRow(0).click();
  await qanStoredMetrics.selectRefreshInterval('5s');
  await expect(qanStoredMetrics.elements.selectedMainMetric).toContainText('Database');
  await expect(qanStoredMetrics.builders.sortingValue(2)).toHaveClass('sort-by asc', {
    timeout: Timeouts.THIRTY_SECONDS,
  });
  await qanStoredMetrics.buttons.showSelected.click();
  await expect(qanStoredMetrics.elements.filterLabels.first()).toHaveText(/^postgres/, {
    timeout: Timeouts.TWENTY_SECONDS,
  });
  await expect(qanStoredMetrics.builders.overviewColumn('Bytes Sent')).toBeVisible();
  await expect(qanStoredMetrics.buttons.detailsTab).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  await expect(leftNavigation.elements.timePickerOpenButton).toContainText('Last 1 hour');
  await expect(qanStoredMetrics.inputs.search).toHaveAttribute('value', 'postgres');
});

pmmTest(
  'PMM-T2016 - Verify QAN query: MAX_EXECUTION_TIME does replace numbers values @pmm-ps-integration',
  async ({ cliHelper, credentials, page, qanStoredMetrics, urlHelper }) => {
    const { password, username } = credentials.perconaServer;
    const containerName = cliHelper
      .execute('docker ps --filter name=ps_pmm_ --format "{{.Names }}" | head -n 1')
      .assertSuccess()
      .stdout.trim();

    expect(containerName, 'No ps_pmm_ container found').not.toBe('');

    cliHelper
      .execute(
        `docker exec ${containerName} mysql -h 127.0.0.1 -u ${username} -p${password} --port 3306 -e "SET MAX_EXECUTION_TIME = 1000;"`,
      )
      .assertSuccess();
    await expect(async () => {
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-30m', to: 'now' }));
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await qanStoredMetrics.searchByValue('MAX_EXECUTION_TIME');
      await expect(qanStoredMetrics.elements.spinner).toHaveCount(0, { timeout: Timeouts.ONE_MINUTE });
      await expect(qanStoredMetrics.elements.noData).toBeHidden();
      await expect(qanStoredMetrics.builders.queryRowQueryText(1)).toBeVisible();
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await expect(
      qanStoredMetrics.builders.queryRowQueryText(1),
      'Query should not contain number',
    ).not.toHaveText(/\d/);
    await expect(
      qanStoredMetrics.builders.queryRowQueryText(1),
      'Query should contain question mark that replaces number value',
    ).toContainText('?');
  },
);
