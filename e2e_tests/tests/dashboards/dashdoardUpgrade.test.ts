import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('PMM settings tests for upgrade', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T317 - Verify MySQL Instance Summary Dashboard after upgrade @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('ps_pmm');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
          from: 'now-1h',
          refresh: '5s',
          serviceName: service_name,
        }),
      );
      await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceSummary.metricsWithData);
    },
  );
});
