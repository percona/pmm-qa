import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1262 - Verify Postgresql Dashboard Instance Summary has Data @not-ui-pipeline @pdpgsql-pmm-integration',
  async ({ api, cliHelper, dashboard, page, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.postgresql,
      'pdpgsql_',
    );
    const summary = dashboard.postgresql.postgresqlInstanceSummary;

    await page.goto(
      urlHelper.buildUrlWithParameters(summary.url, { from: 'now-5m', serviceName: service_name, to: 'now' }),
    );
    await dashboard.verifyMetricsPresent(summary.metrics);
    await dashboard.verifyAllPanelsHaveData(summary.noDataMetrics, Timeouts.TWO_MINUTES);

    const container = cliHelper
      .execSilent("docker ps --filter 'name=^pdpgsql_' --format '{{.Names}}'")
      .assertSuccess()
      .getStdOutLines()[0];

    expect(container, 'pdpgsql docker container should exist').toMatch(/^pdpgsql_/);

    for (const agent of ['postgresql_pgstatmonitor_agent', 'postgres_exporter'] as const) {
      cliHelper
        .execute(`docker exec ${container} pmm-admin list | grep ${agent} | grep Running`)
        .assertSuccess();
    }
  },
);
