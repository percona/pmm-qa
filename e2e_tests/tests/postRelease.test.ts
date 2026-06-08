import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const expectedVersion = process.env.PMM_SERVER_LATEST?.trim() as string;

pmmTest(
  'PMM-T2200 - Verify new release is available for upgrade @post-release',
  async ({ grafanaHelper, updatesPage }) => {
    await grafanaHelper.authorize();

    const updateInfo = await pmmTest.step('Check version service reports an update', async () => {
      const info = await updatesPage.getUpdateInfo();

      expect(info.update_available, 'A new release should be available for upgrade').toBe(true);

      return info;
    });

    expect(updateInfo.latest?.version, 'Available version should match the released version').toContain(
      expectedVersion,
    );

    await pmmTest.step('Verify available version is displayed on the Updates page', async () => {
      await updatesPage.open();
      await expect(updatesPage.elements.availableSection).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(updatesPage.elements.availableVersion).toContainText(expectedVersion);
    });
  },
);

pmmTest(
  "PMM-T2201 - Verify What's new link and release notes @post-release",
  async ({ grafanaHelper, updatesPage }) => {
    await grafanaHelper.authorize();
    await updatesPage.open();

    await pmmTest.step("Verify What's new link is displayed", async () => {
      await expect(updatesPage.buttons.whatsNew).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Open release notes and verify the released version', async () => {
      const { href, newTab } = await updatesPage.clickWhatsNew(updatesPage.buttons.whatsNew);

      expect(href, "What's new link should have an href").toBeTruthy();
      await newTab.waitForLoadState();
      expect(newTab.url(), 'Release notes should open an external page').toMatch(/per\.co\.na|percona\.com/);
    });
  },
);

pmmTest(
  'PMM-T2202 - Verify PMM new version on percona.com/downloads @post-release @downloads',
  async ({ downloadsPage }) => {
    await downloadsPage.open();
    await downloadsPage.selectPmmProduct();

    await pmmTest.step('Verify the new version is displayed', async () => {
      await expect(downloadsPage.versionLocator(expectedVersion)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await pmmTest.step('Verify the list of available OSes with packages is not empty', async () => {
      const packages = await downloadsPage.getAvailablePackages();

      expect(packages.length, 'There should be downloadable OS packages for PMM').toBeGreaterThan(0);
    });
  },
);
