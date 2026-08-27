import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const newRetentionDays = 15;
const newRetentionSeconds = `${newRetentionDays * 86_400}s`;
const newPublicAddress = 'pmm-ha.test.percona.com';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2109 - Verify any configuration changes done on PMM-1 should be reflected on PMM-2 @pmm-ha',
  async ({ api, haClusterHelper, page, settingsPage }) => {
    const original = (await api.settingsApi.getSettings()).settings;

    try {
      await pmmTest.step('Go to the Settings page and change data retention and public address', async () => {
        expect(original.pmm_public_address).not.toEqual(newPublicAddress);

        await page.goto(settingsPage.urls.advanced);
        await expect(settingsPage.elements.pageTitle).toBeVisible();

        await settingsPage.inputs.dataRetention.fill(String(newRetentionDays));
        await settingsPage.inputs.publicAddress.fill(newPublicAddress);
        await settingsPage.buttons.applyAdvancedChanges.click();

        await expect(async () => {
          const saved = (await api.settingsApi.getSettings()).settings;

          expect(saved.data_retention).toEqual(newRetentionSeconds);
          expect(saved.pmm_public_address).toEqual(newPublicAddress);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });

      const newLeader = await pmmTest.step(
        'Restart the leader pod',
        async () => await haClusterHelper.failoverLeader(api.haApi),
      );

      await pmmTest.step(`Verify the settings are retained on the new leader "${newLeader}"`, async () => {
        await page.goto(settingsPage.urls.advanced);

        await expect(settingsPage.inputs.dataRetention).toHaveValue(String(newRetentionDays));
        await expect(settingsPage.inputs.publicAddress).toHaveValue(newPublicAddress);
      });
    } finally {
      await api.settingsApi.updateSettings({
        data_retention: original.data_retention,
        pmm_public_address: original.pmm_public_address,
      });
    }
  },
);
