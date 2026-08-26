import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.describe('HA status on an HA cluster', () => {
  pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
    await grafanaHelper.authorize();
    await haClusterHelper.ensureServing(api.haApi);
  });

  pmmTest(
    'PMM-T2134 - Verify the HA status API returns Enabled in HA mode @pmm-ha',
    async ({ haClusterHelper }) => {
      const podNames = haClusterHelper.podNames();

      expect(podNames.length, 'HA runs more than one PMM Server pod').toBeGreaterThan(1);

      for (const podName of podNames) {
        await pmmTest.step(`Verify "${podName}" reports HA status Enabled`, async () => {
          await expect(() => {
            expect(
              haClusterHelper.haStatusFromPod(podName),
              `"${podName}" must report HA status Enabled`,
            ).toEqual('Enabled');
          }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
        });
      }
    },
  );
});

pmmTest.describe('HA status on a non-HA server', () => {
  pmmTest(
    'PMM-T2134 - Verify the HA status API returns Disabled on a non-HA server @settings',
    async ({ api }) => {
      await pmmTest.step('Verify HA status is Disabled', async () => {
        expect(
          await api.haApi.getStatus(),
          'A PMM Server not running in HA mode must report HA status Disabled',
        ).toEqual('Disabled');
      });
    },
  );
});
