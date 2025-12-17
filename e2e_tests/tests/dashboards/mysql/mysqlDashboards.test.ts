import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';

pmmTest(
  'PMM-T319 - Open the MySQL Instances Overview dashboard and verify Metrics are present and graphs are displayed @nightly @pmm-ps-integration',
  async ({ api, dashboard }) => {
    const serviceList = await api.inventoryApi.getServicesByType(ServiceType.mysql);
    const serviceName = serviceList[0].service_name;

    await dashboard.open(dashboard.mysqlInstanceOverview.url, { from: 'now-3h', serviceName });
    await dashboard.verifyMetricsPresent(dashboard.mysqlInstanceOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.mysqlInstanceOverview.noDataMetrics);
    await dashboard.verifyPanelValues(dashboard.mysqlInstanceOverview.metrics);
  },
);
