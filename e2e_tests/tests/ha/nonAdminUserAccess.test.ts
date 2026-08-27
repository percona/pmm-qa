import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const nonAdminUser = { login: 'test_user', password: 'test_user_password' };

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2136 - Verify new added non-admin users are able to access UI after failover @pmm-ha',
  async ({ api, dashboard, grafanaHelper, haClusterHelper, page }) => {
    await pmmTest.step('Create a new non-admin user', async () => {
      const { users } = await grafanaHelper.listUsers();

      if (!users.some((user) => user.login === nonAdminUser.login)) {
        await grafanaHelper.createUser(nonAdminUser.login, nonAdminUser.password);
      }
    });

    await pmmTest.step('Login as the non-admin user', async () => {
      const identity = await grafanaHelper.signInAs(nonAdminUser.login, nonAdminUser.password);

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
        await grafanaHelper.signInAs(nonAdminUser.login, nonAdminUser.password);

        await page.goto(dashboard.home.url);
        await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });
  },
);
