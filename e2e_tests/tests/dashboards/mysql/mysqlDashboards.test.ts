import pmmTest, { data } from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

const services = ['ps_pmm|ms-single', 'pxc_node'];

data(services).pmmTest(
  'PMM-T317 - Open the MySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed for Percona Server for MySQL @pmm-ps-integration',
  async (data, { urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('ps_pmm');
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysqlInstanceSummary.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysqlInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysqlInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysqlInstanceSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T317 - Open the MySQL Instance Summary Dashboard and verify Metrics are present and graphs are displayed for Percona XtraDB Cluster @pmm-ps-integration',
  async ({ page, urlHelper, api, dashboard }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('pxc_node');
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysqlInstanceSummary.url, {
        from: 'now-3h',
        serviceName: service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysqlInstanceSummary.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysqlInstanceSummary.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysqlInstanceSummary.metricsWithData);
  },
);

pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
  async ({ page, urlHelper, api, dashboard }) => {
    const serviceList = await api.inventoryApi.getServicesByType(ServiceType.mysql);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysqlInstanceOverview.url, {
        from: 'now-3h',
        serviceName: serviceList[0].service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysqlInstanceOverview.metricsWithData);
  },
);

data([1, 2]).pmmTest('PMM-T7777', async (data) => {
  console.log(`Data is: ${data}`);
});
