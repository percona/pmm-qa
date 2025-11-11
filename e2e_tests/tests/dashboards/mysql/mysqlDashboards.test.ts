import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
  async ({ page, urlHelper, inventoryApi, dashboard }) => {
    const serviceList = await inventoryApi.getServicesByType(ServiceType.mysql);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mysqlInstanceOverview.url, {
        from: 'now-3h',
        serviceName: serviceList[0].service_name,
      }),
    );

    await dashboard.expandAllRows();
    await dashboard.verifyMetricsPresent(dashboard.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysqlInstanceOverview.metrics);
  },
);
