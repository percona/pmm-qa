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
