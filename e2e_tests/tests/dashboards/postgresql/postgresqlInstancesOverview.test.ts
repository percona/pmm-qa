import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2296 - Verify Top slow queries panel ranks by execution time @dashboards @postgresql-dashboards',
  async ({ api, page, postgresqlInstancesOverviewPage, urlHelper }) => {
    const services = await api.inventoryApi.getServicesByType(ServiceType.postgresql);

    expect(services.length, 'No PostgreSQL services are registered').toBeGreaterThan(0);

    await page.goto(
      urlHelper.buildUrlWithParameters(postgresqlInstancesOverviewPage.url, {
        from: 'now-3h',
        refresh: '10s',
        to: 'now',
      }),
    );

    const { elements, topSlowQueriesColumns, topSlowQueriesRowLimit } = postgresqlInstancesOverviewPage;

    await expect(elements.topSlowQueriesGrid).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
    await postgresqlInstancesOverviewPage.waitForQueryRows();

    await pmmTest.step('Panel exposes the columns the top-N view needs', async () => {
      for (const column of topSlowQueriesColumns) {
        await expect(postgresqlInstancesOverviewPage.columnHeader(column)).toBeVisible();
      }
    });

    await pmmTest.step(`Panel returns at most ${topSlowQueriesRowLimit} rows`, async () => {
      await expect(elements.topSlowQueriesPagination).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

      const totalRows = await postgresqlInstancesOverviewPage.totalRowCount();

      expect(totalRows, 'Panel is capped at the top 500 slowest queries').toBeLessThanOrEqual(
        topSlowQueriesRowLimit,
      );
    });

    await pmmTest.step('Execution Time is ordered slowest first', async () => {
      const executionTimes = await postgresqlInstancesOverviewPage.executionTimeValues();

      // Grafana pages the table, so this covers the first page -- which is the
      // only part a user reads, and the part the ORDER BY has to get right.
      expect(executionTimes.length, 'No Execution Time values were rendered').toBeGreaterThan(0);
      expect(executionTimes, 'Rows are not sorted by execution time descending').toEqual(
        [...executionTimes].sort((a, b) => b - a),
      );
    });
  },
);
