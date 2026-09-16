import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1988 - Verify that all statuses on PMM Health dashboards are UP @nightly  @gssapi-nightly',
  async ({ dashboard, page, urlHelper }) => {
    await page.goto(urlHelper.buildUrlWithParameters(dashboard.pmmHealth.url, { from: 'now-1h', to: 'now' }));

    for (const panel of dashboard.pmmHealth.metrics) {
      const panelContent = dashboard.builders.panelContentByExactName(panel.name);

      await expect(panelContent).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
      await expect(panelContent).toContainText('UP', { timeout: Timeouts.TEN_SECONDS });
    }
  },
);
