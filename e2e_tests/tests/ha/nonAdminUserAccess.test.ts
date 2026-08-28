import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const password = 'test_user_password';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2136 - Verify new added non-admin users are able to access UI after failover @pmm-ha',
  async ({ api, dashboard, grafanaHelper, haClusterHelper, page }) => {
    const login = `non_admin_${Date.now()}`;
    const userId = await grafanaHelper.createUser(login, password);

    try {
      await pmmTest.step(`Login as the non-admin user "${login}"`, async () => {
        const identity = await grafanaHelper.signInAs(login, password);

        expect(identity.isGrafanaAdmin).toBe(false);
      });

      const newLeader = await pmmTest.step(
        'Restart the leader pod',
        async () => await haClusterHelper.failoverLeader(api.haApi),
      );

      await pmmTest.step(`Verify "${newLeader}" is the new leader`, async () => {
        await expect(async () => {
          expect((await api.haApi.getLeaderNode())?.node_name).toEqual(newLeader);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });

      await pmmTest.step('Login as the non-admin user and verify UI access', async () => {
        await expect(async () => {
          await grafanaHelper.signInAs(login, password);

          await page.goto(dashboard.home.url);
          await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
            timeout: Timeouts.THIRTY_SECONDS,
          });
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });
    } finally {
      await grafanaHelper.authorize();
      await grafanaHelper.deleteUser(userId);
    }
  },
);
