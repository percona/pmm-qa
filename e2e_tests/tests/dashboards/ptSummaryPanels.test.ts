import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T672 - Verify summary for MongoDB is displayed on Instance Summary dashboard @dashboards @pt-summary-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      'rs101',
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.instanceSummary.url, {
        from: 'now-5m',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryFingerprint).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
    await expect(dashboard.elements.summaryFingerprint).toContainText('Mongo Executable');
  },
);

pmmTest(
  'PMM-T671 + PMM-T666 + PMM-T672 - Verify summary for PS is displayed on Instance Summary dashboard @dashboards @pt-summary-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      'ps_pmm',
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
        from: 'now-15m',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryFingerprint).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
    await expect(dashboard.elements.summaryFingerprint).toContainText('Percona Toolkit MySQL Summary Report');
  },
);

pmmTest(
  'PMM-T666 - Verify summary for PGSQL is displayed on Instance Summary dashboard @dashboards @pt-summary-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pgsql_');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.postgresql.postgresqlInstanceSummary.url, {
        from: 'now-15m',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryFingerprint).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
    await expect(dashboard.elements.summaryFingerprint).toContainText('Detected PostgreSQL version:');
  },
);

pmmTest(
  'PMM-T666 - Verify summary for PDPGSQL is displayed on Instance Summary dashboard @dashboards @pt-summary-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.postgresql.postgresqlInstanceSummary.url, {
        from: 'now-15m',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect(dashboard.elements.summaryFingerprint).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
    await expect(dashboard.elements.summaryFingerprint).toContainText('Detected PostgreSQL version:');
  },
);

pmmTest.describe('PostgreSQL that accepts only SSL connections', () => {
  let container: string;

  pmmTest.beforeEach(async ({ cliHelper }) => {
    container = cliHelper
      .execSilent("docker ps --filter 'name=^pdpgsql_pgsm_ssl_' --format '{{.Names}}'")
      .assertSuccess()
      .getStdOutLines()[0];

    expect(container, 'pdpgsql_pgsm_ssl docker container should exist').toMatch(/^pdpgsql_pgsm_ssl_\d+$/);
    cliHelper
      .execSilent(
        `docker exec ${container} psql 'host=127.0.0.1 user=pmm password=pmm dbname=postgres sslmode=disable' -c 'SELECT 1'`,
      )
      .assertFailure('no encryption');
  });

  pmmTest(
    'PMM-T2488 - Verify Service Summary shows the PostgreSQL report when the database accepts only SSL connections @dashboards @ssl-postgres',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${container}_ssl_service`);
      const summary = dashboard.postgresql.postgresqlInstanceSummary;

      await pmmTest.step('Open PostgreSQL Instance Summary for the SSL service', async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(summary.url, {
            from: 'now-15m',
            serviceName: service_name,
            to: 'now',
          }),
        );
        await dashboard.waitForDashboardToLoad();
        await expect(dashboard.builders.selectedVariableValues('Service Name')).toHaveText(service_name);
      });

      await pmmTest.step('Expand the Service Summary row and wait for the report', async () => {
        await dashboard.expandRow('Service Summary');
        await expect(dashboard.elements.summaryFingerprint).toContainText(
          summary.serviceSummaryReport.portAndDataDirectoryHeading,
          { timeout: Timeouts.TWO_MINUTES },
        );
      });

      for (const database of ['sbtest1', 'sbtest2']) {
        await expect(dashboard.elements.summaryFingerprint).toContainText(
          summary.serviceSummaryReport.databaseRow(database),
        );
      }
    },
  );
});
