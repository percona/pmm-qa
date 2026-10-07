import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
  await grafanaHelper.authorize();
  await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-60m', to: 'now' }));
  await qanStoredMetrics.waitForLoad();
});

pmmTest(
  'PMM-T1054 + PMM-T1055 - Verify the "Command type" filter for Postgres @qan | SELECT',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.selectFilterContaining('pdpgsql_');
    await expect(qanStoredMetrics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.selectFilter(
      'SELECT',
      qanStoredMetrics.builders.filterCheckboxInGroup('SELECT', 'Command Type'),
    );
    await qanStoredMetrics.searchByValue('INSERT INTO');
    await expect(qanStoredMetrics.elements.noDataMessage).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(qanStoredMetrics.elements.noDataMessage).toHaveText(
      'No queries available for this combination of filters in the selected time frame',
    );
  },
);

pmmTest(
  'PMM-T175 - Verify user is able to apply filter that has dots in label @qan',
  async ({ page, qanStoredMetrics }) => {
    const countBefore = await qanStoredMetrics.getQueryCount();

    await qanStoredMetrics.selectFilterContaining('127.0.0.1');
    await expect(page).toHaveURL(/client_host=127\.0\.0\.1/);
    await expect
      .poll(() => qanStoredMetrics.getQueryCount(), {
        message: 'Query count was expected to change',
        timeout: Timeouts.TWO_MINUTES,
      })
      .not.toBe(countBefore);
  },
);

pmmTest(
  'PMM-T172 - Verify that selecting a filter updates the table data and URL @qan',
  async ({ page, qanStoredMetrics }) => {
    const countBefore = await qanStoredMetrics.getQueryCount();

    await qanStoredMetrics.selectFilter(
      'pxc-dev',
      qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
    );
    await expect(page).toHaveURL(/environment=pxc-dev/);
    await expect
      .poll(() => qanStoredMetrics.getQueryCount(), {
        message: 'Query count was expected to change',
        timeout: Timeouts.TWO_MINUTES,
      })
      .not.toBe(countBefore);
  },
);

pmmTest('PMM-T126 - Verify user is able to Reset All filters @qan', async ({ qanStoredMetrics }) => {
  const countBefore = await qanStoredMetrics.getQueryCount();

  await qanStoredMetrics.selectFilter(
    'pxc-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
  );
  await qanStoredMetrics.selectFilter(
    'ps-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('ps-dev', 'Environment'),
  );
  await expect
    .poll(() => qanStoredMetrics.getQueryCount(), {
      message: 'Query count was expected to change',
      timeout: Timeouts.TWO_MINUTES,
    })
    .not.toBe(countBefore);
  await qanStoredMetrics.buttons.resetAll.click();
  await expect(qanStoredMetrics.buttons.resetAll).toBeDisabled();
  await expect
    .poll(() => qanStoredMetrics.getQueryCount(), {
      message: "Query count wasn't expected to change",
      timeout: Timeouts.TWO_MINUTES,
    })
    .toBeGreaterThanOrEqual(countBefore);
});

pmmTest(
  'PMM-T125 - Verify user is able to Show only selected filter values and Show All filter values @qan',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.selectFilter(
      'pxc-dev',
      qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
    );
    await qanStoredMetrics.selectFilter(
      'ps-dev',
      qanStoredMetrics.builders.filterCheckboxInGroup('ps-dev', 'Environment'),
    );
    await expect(qanStoredMetrics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await qanStoredMetrics.buttons.showSelected.click();
    await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).toHaveCount(2, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await qanStoredMetrics.buttons.showSelected.click();
    await expect
      .poll(() => qanStoredMetrics.elements.filterCheckboxes.visible().count(), {
        timeout: Timeouts.TEN_SECONDS,
      })
      .toBeGreaterThan(2);
  },
);

pmmTest(
  'PMM-T123 - Verify User is able to search for DB types, Env and Cluster @qan',
  async ({ qanStoredMetrics }) => {
    await expect(qanStoredMetrics.inputs.filterBy).toBeAttached({ timeout: Timeouts.THIRTY_SECONDS });

    const countBefore = await qanStoredMetrics.getQueryCount();

    for (const group of [
      'Environment',
      'Cluster',
      'Replication Set',
      'Database',
      'Schema',
      'Node Name',
      'Service Name',
      'Client Host',
      'User Name',
      'Service Type',
      'Application Name',
      'Command Type',
    ]) {
      await qanStoredMetrics.waitForLoad();

      const checkboxes = qanStoredMetrics.builders.filterCheckboxesInGroup(group);
      const position = Math.floor(Math.random() * (await checkboxes.visible().count()));

      await checkboxes.nth(position).click();
      await qanStoredMetrics.waitForLoad();
      await expect
        .poll(() => qanStoredMetrics.getQueryCount(), {
          message: `Query count was expected to change after selecting a "${group}" filter`,
          timeout: Timeouts.TWO_MINUTES,
        })
        .not.toBe(countBefore);
      await qanStoredMetrics.buttons.resetAll.click();
    }
  },
);

pmmTest('PMM-T191 - Verify Reset All and Show Selected filters @qan', async ({ qanStoredMetrics }) => {
  await qanStoredMetrics.selectFilter(
    'pxc-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
  );
  await qanStoredMetrics.selectFilter(
    'ps-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('ps-dev', 'Environment'),
  );
  await qanStoredMetrics.buttons.showSelected.click();
  await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).toHaveCount(2, {
    timeout: Timeouts.TEN_SECONDS,
  });
  await qanStoredMetrics.buttons.resetAll.click();
  await expect
    .poll(() => qanStoredMetrics.elements.filterCheckboxes.visible().count(), {
      timeout: Timeouts.TEN_SECONDS,
    })
    .toBeGreaterThan(2);
  await qanStoredMetrics.selectFilter(
    'pxc-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
  );
  await qanStoredMetrics.buttons.showSelected.click();
  await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).toHaveCount(1, {
    timeout: Timeouts.TEN_SECONDS,
  });
  await qanStoredMetrics.selectFilter(
    'pxc-dev',
    qanStoredMetrics.builders.filterCheckboxInGroup('pxc-dev', 'Environment'),
  );
  await expect
    .poll(() => qanStoredMetrics.elements.filterCheckboxes.visible().count(), {
      timeout: Timeouts.TEN_SECONDS,
    })
    .toBeGreaterThan(1);
});

pmmTest('PMM-T190 - Verify user is able to see n/a filter @qan', async ({ qanStoredMetrics }) => {
  await qanStoredMetrics.inputs.filterBy.fill('n/a', { timeout: Timeouts.ONE_MINUTE });
  await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).not.toHaveCount(0, {
    timeout: Timeouts.TEN_SECONDS,
  });
});

pmmTest(
  'PMM-T390 - Verify that we show info message when empty result is returned @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    await leftNavigation.selectTimeRange('Last 3 hour');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.expandFilterGroup('Database');
    await qanStoredMetrics.selectFilter(
      'postgres',
      qanStoredMetrics.builders.filterCheckboxInGroup('postgres', 'Database'),
    );
    await qanStoredMetrics.expandFilterGroup('Database');
    await qanStoredMetrics.selectFilter(
      'n/a',
      qanStoredMetrics.builders.filterCheckboxInGroup('', 'Database'),
    );
    await qanStoredMetrics.selectFilterContaining('ps_pmm_');
    await qanStoredMetrics.selectFilter(
      'n/a',
      qanStoredMetrics.builders.filterCheckboxInGroup('', 'Database'),
    );
    await expect(qanStoredMetrics.elements.noDataMessage).toContainText(
      'No queries available for this combination of filters',
      { timeout: Timeouts.THIRTY_SECONDS },
    );
  },
);

pmmTest(
  'PMM-T221 - Verify that all filter options are always visible (but some disabled) after selecting an item and % value is changed @qan',
  async ({ leftNavigation, qanStoredMetrics }) => {
    await leftNavigation.selectTimeRange('Last 2 days');
    await qanStoredMetrics.waitForLoad();

    const countBefore = await qanStoredMetrics.getQueryCount();
    const percentageBefore = await qanStoredMetrics.builders
      .filterPercentage('mysql', 'Service Type')
      .innerText();
    const filterCountBefore = await qanStoredMetrics.elements.filterCheckboxes.visible().count();

    await qanStoredMetrics.selectFilter(
      'mysql',
      qanStoredMetrics.builders.filterCheckboxInGroup('mysql', 'Service Type'),
    );
    await qanStoredMetrics.waitForLoad();
    await expect
      .poll(() => qanStoredMetrics.getQueryCount(), {
        message: 'Query count was expected to change',
        timeout: Timeouts.TWO_MINUTES,
      })
      .not.toBe(countBefore);
    await expect(
      qanStoredMetrics.elements.filterCheckboxes.visible(),
      'Count of all available filters should not change when filter is selected.',
    ).toHaveCount(filterCountBefore);
    await qanStoredMetrics.selectFilterContaining('ps_pmm_');
    await expect(
      qanStoredMetrics.builders.filterPercentage('mysql', 'Service Type'),
      'Percentage for filter Service Type was expected to change',
    ).not.toHaveText(percentageBefore);
  },
);

pmmTest('PMM-T437 - Verify short-cut navigation for n/a items @qan', async ({ qanStoredMetrics }) => {
  await expect(qanStoredMetrics.builders.filterLink('pxc-dev-cluster', 'Cluster')).toBeVisible({
    timeout: Timeouts.ONE_MINUTE,
  });
  await qanStoredMetrics.inputs.filterBy.fill('n/a');
  await expect(qanStoredMetrics.builders.filterCheckboxInGroup('', 'Cluster')).toBeVisible();
  await expect(qanStoredMetrics.builders.filterLink('', 'Cluster')).toBeHidden();
  await expect(qanStoredMetrics.builders.filterCheckboxInGroup('', 'Replication Set')).toBeVisible();
  await expect(qanStoredMetrics.builders.filterLink('', 'Replication Set')).toBeHidden();
});

pmmTest(
  'PMM-T2032 - Verify there is no name with brackets in Plan Summary in QAN @qan',
  async ({ qanStoredMetrics }) => {
    for (const bracket of ['{', '}']) {
      await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).not.toHaveCount(0, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await qanStoredMetrics.inputs.filterBy.fill(bracket);
      await expect(qanStoredMetrics.elements.filterCheckboxes.visible()).toHaveCount(0, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await qanStoredMetrics.inputs.filterBy.fill('');
    }
  },
);
