import pmmTest from '@fixtures/pmmTest';
import data from '@fixtures/dataTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

const services = ['ps_pmm|ms-single', 'pxc_node'];

data(services).pmmTest(
  'PMM-T317 - Open the MySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed for Percona Server for MySQL @pmm-ps-integration',
  async (data, { page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceSummary.metricsWithData);
  },
);

data(services).pmmTest(
  'PMM-T318 - Open the MySQL Instances Compare dashboard and verify Metrics are present and graphs are displayed @pmm-ps-integration',
  async (data, { page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstancesCompare.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstancesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.mysql.mysqlInstancesCompare.noDataMetrics(service_name),
    );
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstancesCompare.metricsWithData(service_name));
  },
);

data(services).pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @pmm-ps-integration',
  async (data, { page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(data);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceOverview.metricsWithData);
  },
);

pmmTest(
  'PMM-T324 - Verify MySQL - MySQL User Details dashboard @pmm-ps-integration',
  async ({ page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('ps_pmm');
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlUserDetails.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlUserDetails.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlUserDetails.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlUserDetails.metricsWithData);
  },
);
pmmTest(
  'PMM-T348 - PXC/Galera Node Summary dashboard @pmm-ps-integration',
  async ({ page, urlHelper, dashboard }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraClusterSummary.url, {
        from: 'now-3h',
      }),
    );

    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraClusterSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.pxcGaleraClusterSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraClusterSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T349 - PXC/Galera Nodes Compare dashboard @pmm-ps-integration',
  async ({ page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('pxc_node');
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.pxcGaleraNodesCompare.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysql.pxcGaleraNodesCompare.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.pxcGaleraNodesCompare.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.pxcGaleraNodesCompare.metricsWithData(service_name));
  },
);
