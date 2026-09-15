import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('PMM settings tests for upgrade', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2049 - Verify PostgreSQL Instances Overview after upgrade @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('pgsql');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.postgresql.postgresqlInstancesOverview.url, {
          from: 'now-1h',
          refresh: '5s',
          serviceName: service_name,
        }),
      );
      await dashboard.verifyMetricsPresent(dashboard.postgresql.postgresqlInstancesOverview.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.postgresql.postgresqlInstancesOverview.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.postgresql.postgresqlInstancesOverview.metricsWithData);
    },
  );
});
