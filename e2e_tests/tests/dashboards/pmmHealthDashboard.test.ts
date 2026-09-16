import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1988 - Verify that all statuses on PMM Health dashboards are UP @nightly  @gssapi-nightly',
  async ({ dashboard, page }) => {
    await page.goto(dashboard.pmmHealth.url);

    for (const panel of dashboard.pmmHealth.statusPanels) {
      const panelContent = dashboard.builders
        .gridItemByPanelId(panel.panelId)
        .getByTestId(`data-testid Panel header ${panel.name}`)
        .getByTestId('data-testid panel content');

      await expect(panelContent).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
      await expect(panelContent).toContainText('UP', { timeout: Timeouts.TEN_SECONDS });
    }
  },
);
