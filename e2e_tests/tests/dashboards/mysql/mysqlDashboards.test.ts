import pmmTest from '@fixtures/pmmTest';
import data from '@fixtures/dataTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

const services = ['ps_pmm|mysql_pmm', 'pxc_node'];

pmmTest(
  'PMM-T2103 Open the HAProxy Instance Summary Dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.haproxyInstanceSummary.url, { from: 'now-1h' }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.haproxyInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.haproxyInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.haproxyInstanceSummary.metricsWithData);
  },
);

data(services).pmmTest(
  'PMM-T317 - Open the MySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed for Percona Server for MySQL @pmm-ps-pxc-haproxy-integration',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceSummary.metricsWithData);
  },
);

data(services).pmmTest(
  'PMM-T318 - Open the MySQL Instances Compare dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstancesCompare.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstancesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.mysql.mysqlInstancesCompare.noDataMetrics(service_name),
    );
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstancesCompare.metricsWithData(service_name));
  },
);
data(services).pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @pmm-ps-pxc-haproxy-integration',
  async (data, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceOverview.metricsWithData);
  },
);

pmmTest(
  'PMM-T324 - Verify MySQL - MySQL User Details dashboard @pmm-ps-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('ps_pmm');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlUserDetails.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlUserDetails.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlUserDetails.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlUserDetails.metricsWithData);
  },
);

pmmTest(
  'PMM-T348 - PXC/Galera Node Summary dashboard @pmm-ps-pxc-haproxy-integration',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraClusterSummary.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraClusterSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.pxcGaleraClusterSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraClusterSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T349 - PXC/Galera Nodes Compare dashboard @pmm-ps-pxc-haproxy-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('pxc_node');

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraNodesCompare.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraNodesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.mysql.pxcGaleraNodesCompare.noDataMetrics(service_name),
    );
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraNodesCompare.metricsWithData(service_name));
  },
);

pmmTest(
  'PMM-T430 - Verify metrics on MySQL Group Replication Summary Dashboard @pmm-ps-integration',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlGroupReplicationSummary.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlGroupReplicationSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlGroupReplicationSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlGroupReplicationSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T2029 - Verify dashboard for MySQL Replication Summary @pmm-ps-integration',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      'ps_pmm_replication_.*_2',
      { replication_set: 'ps-async-replication' },
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlReplicationSummary.url, {
        from: 'now-1h',
        serviceName: service_name,
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlReplicationSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlReplicationSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlReplicationSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T2079 - Verify metrics on MySQL MyRocks Details Dashboard @pmm-ps-integration',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlMyRocksDetails.url, {
        from: 'now-1h',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlMyRocksDetails.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlMyRocksDetails.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlMyRocksDetails.metricsWithData);
  },
);
