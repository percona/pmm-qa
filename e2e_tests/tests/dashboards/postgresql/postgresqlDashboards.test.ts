import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('PMM settings tests for upgrade', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2049 - Verify PostgreSQL Instances Overview after upgrade @post-upgrade',
    async ({ api, dashboard, grafanaHelper, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByPartialName('pgsql');
      const overview = dashboard.postgresql.postgresqlInstancesOverview;

      await page.goto(
        urlHelper.buildUrlWithParameters(overview.url, {
          from: 'now-1h',
          refresh: '5s',
          serviceName: service_name,
        }),
      );

      // The QAN table panel title changes across the upgrade boundary and is
      // re-provisioned asynchronously (see the dashboard model), so target
      // whichever variant the live dashboard currently exposes.
      const panels: { title?: string }[] = (await grafanaHelper.getDashboard('postgresql-instance-overview'))
        .dashboard.panels;
      const topQueriesPanelName =
        overview.topQueriesPanelNames.find((name) => panels.some((panel) => panel.title === name)) ??
        overview.topQueriesPanelNames[0];

      await dashboard.verifyMetricsPresent(overview.metrics(topQueriesPanelName));
      await dashboard.verifyAllPanelsHaveData(overview.noDataMetrics);
      await dashboard.verifyPanelValues(overview.metricsWithData(topQueriesPanelName));
    },
  );
});
