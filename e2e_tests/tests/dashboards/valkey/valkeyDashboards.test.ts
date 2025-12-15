import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { valkeyDashboards } from '@pages/dashboards/dashboards.page';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const dashboardName of Object.keys(valkeyDashboards)) {
  pmmTest(
    `PMM-T2087 - ${dashboardName} dashboard metrics @nightly @dashboards`,
    async ({ page, urlHelper, api, dashboard }) => {
      const serviceList = await api.inventoryApi.getServicesByType(ServiceType.valkey);
      const cluster = serviceList[0].cluster;
      const dashboardPage = dashboard.valkeyDashboards[dashboardName];

      await page.goto(
        urlHelper.buildUrlWithParameters(dashboardPage.url, {
          from: 'now-5m',
          cluster,
        }),
      );

      await dashboard.verifyMetricsPresent(dashboardPage.metrics, serviceList);
      await dashboard.verifyAllPanelsHaveData([]);
      await dashboard.verifyPanelValues(dashboardPage.metrics, serviceList);
    },
  );
}
