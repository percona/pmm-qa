import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import ValkeyDashboards from '@valkey';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const dashboardName in ValkeyDashboards) {
  pmmTest(
    `PMM-T2087 - ${dashboardName} dashboard metrics @nightly @dashboards @pmm-valkey-integration`,
    async ({ api, dashboard, page, urlHelper }) => {
      const serviceList = await api.inventoryApi.getServicesByType(ServiceType.valkey);
      const cluster = serviceList[0].cluster;
      const dashboardPage = dashboard.valkey[dashboardName];
      const metrics = Array.isArray(dashboardPage.metrics)
        ? dashboardPage.metrics
        : dashboardPage.metrics(serviceList[0].service_name);

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboardPage.url, {
          cluster,
          from: 'now-5m',
        }),
      );
      await dashboard.verifyMetricsPresent(metrics, serviceList);
      await dashboard.verifyAllPanelsHaveData([]);
      await dashboard.verifyPanelValues(metrics, serviceList);
    },
  );
}
