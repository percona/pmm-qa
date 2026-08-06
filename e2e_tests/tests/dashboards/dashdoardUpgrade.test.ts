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

  pmmTest(
    'Verify MongoDB Router Summary after upgrade @post-upgrade',
    async ({ dashboard, page, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.routerSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(dashboard.mongo.routerSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mongo.routerSummary.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.mongo.routerSummary.metricsWithData);
    },
  );

  pmmTest(
    'PMM-T9999 Verify MongoDB Sharded Cluster Summary after upgrade @post-upgrade',
    async ({ dashboard, page, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(dashboard.mongo.shardedClusterSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mongo.shardedClusterSummary.noDataMetrics);
      await dashboard.verifyPanelValues(dashboard.mongo.shardedClusterSummary.metricsWithData);
    },
  );
});
