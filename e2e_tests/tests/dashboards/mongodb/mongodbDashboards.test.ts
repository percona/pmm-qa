import pmmTest from '@fixtures/pmmTest';
import { GetService } from '@interfaces/inventory';

pmmTest.describe('PMM tests for mongodb dashboards', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest('Verify MongoDB Router Summary @post-upgrade', async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.routerSummary.url, {
        from: 'now-1h',
        refresh: '5s',
      }),
    );

    await dashboard.verifyMetricsPresent(dashboard.mongo.routerSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mongo.routerSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mongo.routerSummary.metricsWithData);
  });

  pmmTest(
    'Verify MongoDB Sharded Cluster Summary @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const shardNames = ['rs1', 'rs2'];
      const nodeNames = ['rs1', 'rs2', 'rscfg'];
      const serviceNames = (await api.inventoryApi.getAllServiceDetailsByRegex('rs(?:cfg)?\\d+_\\d+')).map(
        (service: GetService) => service.service_name,
      );

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
          from: 'now-1h',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(
        dashboard.mongo.shardedClusterSummary.metrics(shardNames, nodeNames, serviceNames),
      );
      await dashboard.verifyAllPanelsHaveData(
        dashboard.mongo.shardedClusterSummary.noDataMetrics(shardNames, nodeNames, serviceNames),
      );
      await dashboard.verifyPanelValues(dashboard.mongo.shardedClusterSummary.metricsWithData(shardNames));
    },
  );

  pmmTest('Verify MongoDB ReplSet Summary @post-upgrade', async ({ api, dashboard, page, urlHelper }) => {
    const services: GetService[] = await api.inventoryApi.getAllServiceDetailsByRegex('rs(?:cfg)?\\d+_\\d+');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
        cluster: 'sharded',
        from: 'now-1h',
        refresh: '30s',
      }),
    );
    await dashboard.collapseAllRows();

    const metrics = dashboard.mongo.replSetSummary.metrics(
      services.map((service) => service.service_name),
      services.map((service) => service.node_name),
    );

    for (const metric of metrics) {
      const noDataMetrics = dashboard.mongo.replSetSummary.noDataMetricsForRow(
        metric.rowName,
        services.map((service) => service.service_name),
      );

      await dashboard.expandRow(metric.rowName);
      await dashboard.waitForDashboardToLoad();
      await dashboard.verifyRowMetricsPresent(metric.rowName, metric.metrics);
      await dashboard.verifyRowPanelsHaveData(metric.rowName, noDataMetrics);
      await dashboard.verifyRowPanelValues(
        metric.rowName,
        dashboard.mongo.replSetSummary.metricsWithDataForRow(
          metric.rowName,
          services.map((service) => service.service_name),
          services.map((service) => service.node_name),
        ),
      );
      await dashboard.collapseRow(metric.rowName);
    }
  });
});
