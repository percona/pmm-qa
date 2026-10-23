import pmmTest from '@fixtures/pmmTest';
import { GetService } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('PMM tests for mongodb dashboards', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T1932 - Verify MongoDB Router Summary @pmm-psmdb-sharding-integration @post-upgrade',
    async ({ api, dashboard, page, urlHelper }) => {
      await api.prometheusApi.waitForSampleBeforeFiveMinuteBoundary(
        'mongodb_ss_uptime{node_name=~"mongos.*"}',
      );
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

      await api.prometheusApi.waitForSampleBeforeFiveMinuteBoundary(
        'mongodb_mongod_replset_my_state{cluster="sharded"}',
      );
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

  pmmTest(
    'PMM-T305 - Open the MongoDB Instance Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards @gssapi-nightly',
    async ({ api, dashboard, page, urlHelper }) => {
      const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.instanceSummary.url, {
          cluster: service.cluster,
          from: 'now-5m',
          refresh: '5s',
          serviceName: service.service_name,
        }),
      );

      await dashboard.verifyMetricsPresent(dashboard.mongo.instanceSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(dashboard.mongo.instanceSummary.noDataMetrics);
    },
  );

  pmmTest(
    'PMM-T2401 - Open the MongoDB Cluster Summary Dashboard and verify Metrics are present and graphs are displayed @nightly @dashboards',
    async ({ api, dashboard, page, urlHelper }) => {
      const serviceNames = (
        await api.inventoryApi.getAllServiceDetailsByRegex('rs(?:cfg)?[0-9]+_[0-9]+')
      ).map((service: GetService) => service.service_name);

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
          cluster: 'sharded',
          from: 'now-5m',
          refresh: '5s',
        }),
      );

      await dashboard.verifyMetricsPresent(
        dashboard.mongo.shardedClusterSummary.metrics(['rs1', 'rs2'], ['rs1', 'rs2', 'rscfg'], serviceNames),
      );
      await dashboard.verifyAllPanelsHaveData(
        dashboard.mongo.shardedClusterSummary.noDataMetrics(serviceNames),
      );
    },
  );

  pmmTest(
    'PMM-T1698 - Verify that Disk I/O and Swap Activity and Network Traffic panels have graphs if Node name contains dot symbol @nightly @dashboards @gssapi-nightly',
    async ({ api, dashboard, page, urlHelper }) => {
      const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
      const rows = dashboard.mongo.replSetSummary.metrics([service.service_name], [service.node_name]);

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
          cluster: service.cluster,
          from: 'now-5m',
          refresh: '5s',
          serviceName: service.service_name,
        }),
      );

      await dashboard.verifyMetricsPresent(
        rows.flatMap(({ metrics }) => metrics),
        undefined,
        true,
      );
      await dashboard.verifyAllPanelsHaveData(
        rows.flatMap(({ rowName }) =>
          dashboard.mongo.replSetSummary.noDataMetricsForRow(rowName, [service.service_name]),
        ),
      );
    },
  );

  pmmTest(
    'PMM-T1333 - Verify MongoDB - MongoDB Collections Overview @mongodb-exporter @nightly @gssapi-nightly',
    async ({ api, dashboard, page, urlHelper }) => {
      const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

      for (const metric of ['mongodb_top_commands_count', 'mongodb_dbstats_dataSize']) {
        await api.grafanaApi.waitForMetric(
          `${metric}{service_name="${service.service_name}"}`,
          Timeouts.TWO_MINUTES,
        );
      }

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.collectionsOverview.url, {
          from: 'now-5m',
          nodeName: service.node_name,
          refresh: '5s',
          serviceName: service.service_name,
        }),
      );

      await dashboard.verifyMetricsPresent(dashboard.mongo.collectionsOverview.metrics, undefined, true);
      await dashboard.verifyAllPanelsHaveData(dashboard.mongo.collectionsOverview.noDataMetrics);
    },
  );

  pmmTest(
    'PMM-T2035 - Verify MongoDB ReplSet dashboard has FCV panel @nightly @dashboards @gssapi-nightly',
    async ({ api, dashboard, page, urlHelper }) => {
      const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
          cluster: service.cluster,
          from: 'now-5m',
          refresh: '5s',
        }),
      );

      await expect
        .poll(dashboard.getFeatureCompatibilityVersion, {
          message: 'Feature Compatibility Version is not correct.',
          timeout: Timeouts.THIRTY_SECONDS,
        })
        .toBe(parseFloat(process.env.PSMDB_VERSION || '8.0'));
    },
  );

  pmmTest(
    'PMM-T2035 - Verify MongoDB Cluster dashboard has FCV panel @nightly @dashboards',
    async ({ dashboard, page, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.shardedClusterSummary.url, {
          cluster: 'sharded',
          from: 'now-5m',
          refresh: '5s',
        }),
      );

      await expect
        .poll(dashboard.getFeatureCompatibilityVersion, {
          message: 'Feature Compatibility Version is not correct.',
          timeout: Timeouts.THIRTY_SECONDS,
        })
        .toBe(parseFloat(process.env.PSMDB_VERSION || '8.0'));
    },
  );

  pmmTest(
    'PMM-T2003 - Verify that MongoDB Compare dashboard has Cluster, Replication, Node filters @nightly',
    async ({ api, dashboard, page, urlHelper }) => {
      const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');
      const serviceNames = (await api.inventoryApi.getAllServiceDetailsByRegex('^rs(?:cfg)?[0-9]+'))
        .filter(({ environment }) => environment === service.environment)
        .map(({ service_name }) => service_name);
      const serviceInfoPanels = serviceNames.map((serviceName) => `${serviceName} - Service Info`);

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboard.mongo.instancesCompare.url, {
          from: 'now-5m',
          refresh: '5s',
        }),
      );

      await dashboard.selectVariableValue('Environment', service.environment);
      await dashboard.verifyPanelsDisplayed(serviceInfoPanels);
      await dashboard.unselectVariableValue('Environment');

      await dashboard.selectVariableValue('Cluster', service.cluster);
      await dashboard.verifyPanelsDisplayed(serviceInfoPanels);
      await dashboard.unselectVariableValue('Cluster');

      await dashboard.selectVariableValue('Replication Set', service.replication_set);
      await expect(page).toHaveURL(new RegExp(`[?&]var-replication_set=${service.replication_set}(&|$)`), {
        timeout: Timeouts.TEN_SECONDS,
      });
      await dashboard.unselectVariableValue('Replication Set');

      await dashboard.selectVariableValue('Node', serviceNames[0]);
      await dashboard.verifyPanelsDisplayed([serviceInfoPanels[0]]);
    },
  );
});
