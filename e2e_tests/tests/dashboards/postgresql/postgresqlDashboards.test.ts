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
        urlHelper.buildUrlWithParameters(dashboard.pgsql.instanceOverview.url, {
          from: 'now-1h',
          refresh: '5s',
          serviceName: service_name,
        }),
      );
      await dashboard.verifyMetricsPresent(dashboard.pgsql.instanceOverview.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.pgsql.instanceOverview.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.pgsql.instanceOverview.metricsWithData);
    },
  );
});
