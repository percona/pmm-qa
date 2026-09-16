import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import PmmHealthDashboard from '@pages/dashboards/pmmHealth';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

for (const panel of new PmmHealthDashboard().metrics) {
  pmmTest(
    `PMM-T1988 - Verify that all statuses on PMM Health dashboards are UP @nightly  @gssapi-nightly | ${panel.name}`,
    async ({ dashboard, page }) => {
      const panelContent = dashboard.builders
        .panelByExactName(panel.name)
        .getByTestId('data-testid panel content');

      await page.goto(dashboard.pmmHealth.url);
      await expect(panelContent).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
      await expect(panelContent).toContainText('UP', { timeout: Timeouts.TEN_SECONDS });
    },
  );
}
