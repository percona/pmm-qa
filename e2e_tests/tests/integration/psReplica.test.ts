import pmmTest from '@fixtures/pmmTest';
import data from '@fixtures/dataTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const replicationSet = 'ps-async-replication';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

data(['_1', '_2']).pmmTest(
  'PMM-T2029 - Verify dashboard for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly',
  async (suffix, { api, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      `^ps_pmm_replication_.*${suffix}(_\\d+)?$`,
      { replication_set: replicationSet },
    );
    const replication = dashboard.mysql.mysqlReplicationSummary;
    const noDataMetrics = suffix === '_1' ? replication.sourceNoDataMetrics : replication.noDataMetrics;

    await page.goto(
      urlHelper.buildUrlWithParameters(replication.url, {
        from: 'now-5m',
        refresh: '5s',
        serviceName: service_name,
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(replication.metrics(service_name));
    await dashboard.verifyAllPanelsHaveData(noDataMetrics, Timeouts.TWO_MINUTES);
    await dashboard.verifyPanelValues(replication.metricsWithData(service_name, noDataMetrics));
  },
);

pmmTest(
  'PMM-T2030 - Verify QAN for PS Replica Instance @pmm-ps-replica-integration @not-ui-pipeline @nightly',
  async ({ api, page, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^ps_pmm_replication_.*_1(_\\d+)?$',
      { replication_set: replicationSet },
    );

    await page.goto(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
        from: 'now-12h',
        replicationSet,
        schema: 'sbtest',
        serviceName: service_name,
      }),
    );
    await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.TWO_MINUTES);

    expect(
      await qanStoredMetrics.getQueryCount(),
      `The queries for service ${service_name} instance do NOT exist, check QAN Data`,
    ).toBeGreaterThan(0);
  },
);
