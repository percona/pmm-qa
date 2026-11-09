import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1642 - Verify that filtering by Environment works OS dashboards @docker-configuration',
  async ({ api, cliHelper, dashboard, page, urlHelper }) => {
    const environment = 'dev';

    cliHelper
      .execute(`sudo pmm-admin config --force --custom-labels=environment=${environment}`)
      .assertSuccess();
    await api.grafanaApi.waitForMetric(
      `node_boot_time_seconds{environment="${environment}"}`,
      Timeouts.TWO_MINUTES,
    );
    await api.grafanaApi.waitForMetric(
      `rate(node_netstat_Tcp_RetransSegs{environment="${environment}"}[1h])`,
      Timeouts.TWO_MINUTES,
    );
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesOverview.url, {
        environment,
        from: 'now-5m',
        to: 'now',
      }),
    );
    await dashboard.verifyAllPanelsHaveData(dashboard.os.nodesOverview.noDataMetrics);
  },
);
