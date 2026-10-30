import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.describe('PMM settings tests for upgrade', () => {
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

pmmTest(
  'PMM-T2050 - Verify PostgreSQL Instance Summary Dashboard @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_pmm_(?!.*patroni).*$');
    const summary = dashboard.postgresql.postgresqlInstanceSummary;

    await page.goto(
      urlHelper.buildUrlWithParameters(summary.url, { from: 'now-1h', serviceName: service_name, to: 'now' }),
    );
    await dashboard.verifySlowQueriesPanel('60 minutes');
    await dashboard.verifyMetricsPresent(summary.metrics);
    await dashboard.verifyAllPanelsHaveData(summary.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2049 - Verify PostgreSQL Instances Overview Dashboard @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    const overview = dashboard.postgresql.postgresqlInstancesOverview;

    await page.goto(urlHelper.buildUrlWithParameters(overview.url, { from: 'now-5m', to: 'now' }));
    await dashboard.verifySlowQueriesPanel('5 minutes');
    await dashboard.verifyMetricsPresent(overview.metrics());
    await dashboard.verifyAllPanelsHaveData(overview.noDataMetrics);
  },
);

pmmTest(
  'PMM-T394 - PostgreSQL Instance Compare Dashboard metrics @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const services = [
      await api.inventoryApi.getServiceDetailsByPartialName('pdpgsql_'),
      await api.inventoryApi.getServiceDetailsByRegex('^pgsql_'),
    ];

    if (!(await api.haApi.isEnabled())) {
      services.push(await api.inventoryApi.getServiceDetailsByPartialName('pmm-server-postgresql'));
    }

    const compare = dashboard.postgresql.postgresqlInstancesCompare;

    await page.goto(
      urlHelper.buildUrlWithParameters(compare.url, {
        from: 'now-5m',
        serviceName: services.map(({ service_name }) => service_name),
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(compare.metrics, undefined, true);
    await dashboard.verifyAllPanelsHaveData(compare.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2044 - Verify PostgreSQL Top Queries Dashboard metrics @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_pmm_(?!.*patroni).*$');
    const topQueries = dashboard.postgresql.postgresqlTopQueries;

    await page.goto(
      urlHelper.buildUrlWithParameters(topQueries.url, {
        from: 'now-12h',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(topQueries.metrics, undefined, true);
    await dashboard.verifyAllPanelsHaveData(topQueries.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2048 - Verify PostgreSQL Instances Overview Extended metrics @nightly @dashboards',
  async ({ api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_pmm_(?!.*patroni).*$');
    const overviewExtended = dashboard.postgresql.postgresqlInstancesOverviewExtended;

    await page.goto(
      urlHelper.buildUrlWithParameters(overviewExtended.url, {
        from: 'now-30m',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(overviewExtended.metrics);
    await dashboard.verifyAllPanelsHaveData(overviewExtended.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2051 - Verify PostgreSQL Replication Overview dashboard @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    const replication = dashboard.postgresql.postgresqlReplicationOverview;

    await page.goto(urlHelper.buildUrlWithParameters(replication.url, { from: 'now-1h', to: 'now' }));
    await dashboard.verifyMetricsPresent(replication.metrics);
    await dashboard.verifyAllPanelsHaveData(replication.noDataMetrics);
  },
);

pmmTest(
  'PMM-T2053 - Verify PostgreSQL Patroni Details dashboard @nightly @dashboards',
  async ({ dashboard, page, urlHelper }) => {
    const patroni = dashboard.postgresql.postgresqlPatroniDetails;

    await page.goto(urlHelper.buildUrlWithParameters(patroni.url, { from: 'now-5m', to: 'now' }));
    await dashboard.verifyMetricsPresent(patroni.metrics, undefined, true);
    await dashboard.verifyAllPanelsHaveData(patroni.noDataMetrics);
  },
);
