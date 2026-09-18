import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1642 - Verify that filtering by Environment works OS dashboards @docker-configuration',
  async ({ api, cliHelper, dashboard, page, urlHelper }) => {
    const environment = 'dev';

    cliHelper.execute(`sudo pmm-admin config --custom-labels=environment=${environment}`).assertSuccess();
    await api.grafanaApi.waitForMetric(
      `node_boot_time_seconds{environment="${environment}"}`,
      Timeouts.TWO_MINUTES,
    );
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.os.nodesOverview.url, {
        environment,
        from: 'now-5m',
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await expect
      .poll(() => dashboard.elements.noDataPanelName.count(), {
        message: `Nodes Overview filtered by environment=${environment} should show at most 4 panels without data`,
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBeLessThanOrEqual(4);
  },
);
