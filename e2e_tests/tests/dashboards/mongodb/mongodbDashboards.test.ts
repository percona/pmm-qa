import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import PrometheusApi from '@api/prometheus.api';
import { GetService } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';

// Router and ReplSet Summary stat panels query at a fixed 5m step, so a series shows
// "No data" until it has a sample before the last 5-minute boundary.
const waitForFiveMinuteStep = async (prometheusApi: PrometheusApi, selector: string) => {
  await expect
    .poll(
      () =>
        prometheusApi.instantQueryValue(
          `min(count_over_time(${selector}[1m] offset ${Math.floor(Date.now() / 1_000) % 300}s))`,
        ),
      {
        intervals: [Timeouts.THIRTY_SECONDS],
        message: `${selector} has no sample before the last 5-minute boundary`,
        timeout: Timeouts.TEN_MINUTES,
      },
    )
    .toBeGreaterThan(0);
};

pmmTest.describe('PMM tests for mongodb dashboards', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T1932 - Verify MongoDB Router Summary @pmm-psmdb-sharding-integration @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      await waitForFiveMinuteStep(api.prometheusApi, 'mongodb_ss_uptime{node_name=~"mongos.*"}');
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

  // skip-until: 2026-10-23 -- Top Hottest Collections panels flap to No data at the 30s high resolution the upgrade suite sets (PMM-15714).
  // eslint-disable-next-line playwright/no-skipped-test -- product bug PMM-15714, see the skip-until line above.
  pmmTest.skip(
    'PMM-T2012 - Verify MongoDB Sharded Cluster Summary @pmm-psmdb-sharding-integration @post-upgrade',
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
        dashboard.mongo.shardedClusterSummary.noDataMetrics(serviceNames),
      );
      await dashboard.verifyPanelValues(dashboard.mongo.shardedClusterSummary.metricsWithData(shardNames));
    },
  );

  pmmTest(
    'PMM-T2385 - Verify MongoDB ReplSet Summary @pmm-psmdb-sharding-integration @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      const services: GetService[] =
        await api.inventoryApi.getAllServiceDetailsByRegex('rs(?:cfg)?\\d+_\\d+');

      await waitForFiveMinuteStep(api.prometheusApi, 'mongodb_mongod_replset_my_state');
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
        await dashboard.verifyPanelValuesInView(
          dashboard.mongo.replSetSummary.metricsWithDataForRow(
            metric.rowName,
            services.map((service) => service.service_name),
            services.map((service) => service.node_name),
          ),
        );
        await dashboard.collapseRow(metric.rowName);
      }
    },
  );
});
