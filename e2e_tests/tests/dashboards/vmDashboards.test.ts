import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T506 - Verify metrics on VictoriaMetrics dashboard @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page }) => {
    await page.goto(dashboard.insight.victoriaMetrics.url);
    await dashboard.verifyMetricsPresent(dashboard.insight.victoriaMetrics.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.insight.victoriaMetrics.noDataMetrics);
  },
);

pmmTest(
  'PMM-T507 Verify metrics on VM Agents Overview Dashboard @nightly @dashboards @gssapi-nightly',
  async ({ api, dashboard, page, urlHelper }) => {
    const { node_name } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      'rs101',
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.insight.victoriaMetricsAgentsOverview.url, {
        from: 'now-10m',
        nodeName: node_name,
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.insight.victoriaMetricsAgentsOverview.metrics(node_name));
    await dashboard.verifyAllPanelsHaveData(
      dashboard.insight.victoriaMetricsAgentsOverview.noDataMetrics(node_name),
    );
  },
);
