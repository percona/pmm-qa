import pmmTest from '@fixtures/pmmTest';

pmmTest.describe('PMM settings tests for upgrade', () => {
  const services = [
    { metric: 'mysql_global_status_max_used_connections', serviceName: 'ps_pmm', serviceType: 'mysql' },
    { metric: 'pg_stat_database_xact_rollback', serviceName: 'pgsql_pgs', serviceType: 'postgresql' },
    { metric: 'mongodb_connections', serviceName: 'rs101', serviceType: 'mongodb' },
  ];

  for (const service of services) {
    pmmTest(
      `Check metrics present after upgrade for service ${service.serviceType} @post-upgrade`,
      async ({ api }) => {
        const serviceName = await api.inventoryApi.getServiceDetailsByPartialName(service.serviceName);

        await api.grafanaApi.waitForMetric(service.metric, serviceName.service_name);
      },
    );
  }

  pmmTest(
    'Verify metrics from custom queries for mysqld_exporter after upgrade @post-upgrade',
    async ({ api }) => {
      const metricName = 'mysql_performance_schema_memory_summary_current_bytes';
      // const serviceName = await api.inventoryApi.getServiceDetailsByPartialName('ps_pmm');

      await api.grafanaApi.waitForMetric(metricName);
    },
  );

  pmmTest(
    'Verify metrics from custom queries for postgres_exporter after upgrade @post-upgrade',
    async ({ api }) => {
      const metricName = 'pg_stat_user_tables_analyze_count';
      // const serviceName = await api.inventoryApi.getServiceDetailsByPartialName('pgsql_pgss');

      await api.grafanaApi.waitForMetric(metricName);
    },
  );

  pmmTest(
    'Verify textfile collector extend metrics is still collected post upgrade @post-upgrade',
    async ({ api }) => {
      const metricName = 'node_role';

      await api.grafanaApi.waitForMetric(metricName);
    },
  );
});
