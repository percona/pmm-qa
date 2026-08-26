import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const newRetentionDays = 15;
const newRetentionSeconds = `${newRetentionDays * 86_400}s`;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2109 - Verify any configuration changes done on PMM-1 should be reflected on PMM-2 @pmm-ha',
  async ({ api, haClusterHelper, k8sHelper, page, settingsPage }) => {
    const original = (await api.settingsApi.getSettings()).settings;

    try {
      const initialLeader = haClusterHelper.leaderFromPods();

      await page.goto(settingsPage.urls.advanced);
      await expect(settingsPage.elements.pageTitle).toBeVisible();

      const publicAddress = new URL(page.url()).host;

      await pmmTest.step('Change data retention and public address', async () => {
        await settingsPage.inputs.dataRetention.fill(String(newRetentionDays));
        await settingsPage.inputs.publicAddress.fill(publicAddress);
        await settingsPage.buttons.applyAdvancedChanges.click();
      });

      await pmmTest.step('Verify the changes are saved', async () => {
        await expect(async () => {
          const saved = (await api.settingsApi.getSettings()).settings;

          expect(saved.data_retention, 'Data retention must be saved').toEqual(newRetentionSeconds);
          expect(saved.pmm_public_address, 'Public address must be saved').toEqual(publicAddress);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });

      const newLeader = await pmmTest.step(`Restart the leader pod "${initialLeader}"`, async () => {
        k8sHelper.deletePod(initialLeader).assertSuccess();

        return await haClusterHelper.waitForLeaderChange(initialLeader, Timeouts.FIVE_MINUTES);
      });

      await pmmTest.step(`Verify the settings are served by the new leader "${newLeader}"`, async () => {
        await expect(async () => {
          const response = await page.goto(settingsPage.urls.advanced);

          expect(
            response?.status(),
            'HAProxy must route to the new leader before the settings page can be read',
          ).toBeLessThan(400);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

        await expect(settingsPage.inputs.dataRetention).toHaveValue(String(newRetentionDays));
        await expect(settingsPage.inputs.publicAddress).toHaveValue(publicAddress);
      });
    } finally {
      await api.settingsApi.updateSettings({
        data_retention: original.data_retention,
        pmm_public_address: original.pmm_public_address,
      });
    }
  },
);
