import pmmTest from '@fixtures/pmmTest';
import { AdvisorScheduleEmailMode } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('PMM Advisors tests for upgrade', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  // Before upgrading from 3.6 to 3.10, the @pre-upgrade tests of the pmm-3.x branches disable
  // mongodb_version and set postgresql_unsupported_check to the Frequent interval.
  pmmTest(
    'PMM-Txxxx - Verify Advisors start from the default schedule with every check enabled after upgrade @post-upgrade',
    async ({ api, page, settingsPage }) => {
      await pmmTest.step('Checks disabled before the upgrade are enabled again', async () => {
        const checks = await api.advisorsApi.listChecks();

        expect(checks.find(({ name }) => name === 'mongodb_version')?.enabled).toBe(true);
        expect(checks.filter(({ enabled }) => !enabled).map(({ name }) => name)).toEqual([]);
      });

      await pmmTest.step('The default schedule runs every check daily', async () => {
        expect(await api.advisorsApi.findSchedule('All checks daily')).toMatchObject({
          check_names: [],
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          email_mode: AdvisorScheduleEmailMode.settings,
          enabled: true,
          service_ids: [],
          time_of_day: '06:00',
        });
      });

      await pmmTest.step('Settings keep the Advisors switch and get a 30-day history', async () => {
        const { settings } = await api.settingsApi.getSettings();

        expect(settings).toMatchObject({ advisor_enabled: true, advisor_history_retention: '2592000s' });
        await page.goto(settingsPage.urls.advisors);
        await expect(settingsPage.inputs.advisorRetention).toHaveValue('30');
      });

      await pmmTest.step('A bookmark of the old Advisors page opens the new one', async () => {
        await page.goto('graph/advisors');
        await expect(page).toHaveURL(/\/pmm-ui\/advisors$/);
      });
    },
  );
});
