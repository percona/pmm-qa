import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'Open Advanced Exploration Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.insight.advancedDataExploration.url, {
        metric: 'go_gc_duration_seconds',
        refresh: '1m',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.insight.advancedDataExploration.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.insight.advancedDataExploration.noDataMetrics);
  },
);

pmmTest(
  'Open the Prometheus Exporters Status Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.insight.prometheusExporterStatus.url, {
        from: 'now-5m',
        nodeName: 'pmm-server',
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.insight.prometheusExporterStatus.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.insight.prometheusExporterStatus.noDataMetrics);
  },
);

pmmTest(
  'PMM-T300 - Open the Prometheus Exporters Overview Dashboard and verify Metrics are present and graphs are displayed @nightly  @dashboards @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.insight.prometheusExportersOverview.url, {
        from: 'now-5m',
        nodeName: 'pmm-server',
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(dashboard.insight.prometheusExportersOverview.metrics);
    await dashboard.verifyAllPanelsHaveData(dashboard.insight.prometheusExportersOverview.noDataMetrics);
  },
);
