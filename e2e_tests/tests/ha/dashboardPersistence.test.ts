import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const suffix = Date.now();
const dashboardTitle = `PMM-T2137 HA dashboard ${suffix}`;
const panelTitle = 'HA TESTING';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2137 - Verify new dashboards are retained after failover @pmm-ha',
  async ({ api, dashboard, haClusterHelper, page }) => {
    let uid = '';

    try {
      const url = await pmmTest.step(
        `Create a new dashboard with a panel titled "${panelTitle}"`,
        async () => {
          const created = await api.grafanaApi.createDashboard(dashboardTitle, panelTitle);

          uid = created.uid;

          await page.goto(created.url);
          await expect(dashboard.elements.panelName).toHaveText(panelTitle, {
            timeout: Timeouts.ONE_MINUTE,
          });

          return created.url;
        },
      );

      await pmmTest.step('Restart the leader pod', async () => {
        await haClusterHelper.failoverLeader(api.haApi);
      });

      await pmmTest.step('Open the UI again and verify the dashboard is retained', async () => {
        await expect(async () => {
          await page.goto(url);
          await expect(dashboard.elements.panelName).toHaveText(panelTitle, {
            timeout: Timeouts.THIRTY_SECONDS,
          });
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });
    } finally {
      if (uid) await api.grafanaApi.deleteDashboard(uid);
    }
  },
);
