import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
  async ({ page, urlHelper, api, dashboard }) => {
    const serviceList = await api.inventoryApi.getServicesByType(ServiceType.mysql);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
        from: 'now-3h',
        serviceName: serviceList[0].service_name,
      }),
    );

    await dashboard.verifyMetricsPresent(dashboard.mysql.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysql.mysqlInstanceOverview.metrics);
  },
);
