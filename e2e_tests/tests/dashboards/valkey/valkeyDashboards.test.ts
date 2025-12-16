import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { valkeyDashboards } from '@pages/dashboards/dashboards.page';

for (const dashboardName of Object.keys(valkeyDashboards)) {
  pmmTest(
    `PMM-T2087 - ${dashboardName} dashboard metrics @nightly @dashboards`,
    async ({ api, dashboard }) => {
      const serviceList = await api.inventoryApi.getServicesByType(ServiceType.valkey);
      const cluster = serviceList[0].cluster;
      const dashboardPage = dashboard.valkeyDashboards[dashboardName];

      await dashboard.open(dashboardPage.url, { from: 'now-5m', cluster });
      await dashboard.verifyMetricsPresent(dashboardPage.metrics, serviceList);
      await dashboard.verifyAllPanelsHaveData([]);
      await dashboard.verifyPanelValues(dashboardPage.metrics, serviceList);
    },
  );
}
