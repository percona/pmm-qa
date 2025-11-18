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
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
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
