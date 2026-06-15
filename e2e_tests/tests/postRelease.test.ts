import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

if (!process.env.PMM_SERVER_LATEST?.trim()) {
  throw new Error('PMM_SERVER_LATEST env var is required for @post-release tests');
}

const expectedVersion = process.env.PMM_SERVER_LATEST.trim();

pmmTest.beforeEach(async ({ context, page }) => {
  await page.unroute(apiEndpoints.server.updates);
  await context.unroute(apiEndpoints.server.updates);
  await page.unroute(apiEndpoints.users.me);
  await context.unroute(apiEndpoints.users.me);
});

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
      await expect(updatesPage.elements.availableSection).toContainText(expectedVersion);
      await expect(updatesPage.elements.newVersionLine).toContainText(expectedVersion);
    });
  },
);

pmmTest(
  "PMM-T2201 - Verify What's new link and release notes @post-release",
  async ({ grafanaHelper, updatesPage }) => {
    await grafanaHelper.authorize();
    await updatesPage.openHomeForWhatsNew();

    await pmmTest.step("Verify What's new link on home page", async () => {
      await expect(updatesPage.buttons.whatsNew).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(updatesPage.buttons.whatsNew).toHaveAttribute(
        'href',
        new RegExp(`per\\.co\\.na/pmm/${expectedVersion.replaceAll('.', '\\.')}`),
      );
    });

    await pmmTest.step('Open release notes and verify the released version', async () => {
      const { newTab } = await updatesPage.clickReleaseNotes(updatesPage.buttons.whatsNew);

      await expect(newTab).toHaveURL(
        `https://docs.percona.com/percona-monitoring-and-management/3/release-notes/${expectedVersion}.html`,
      );
    });
  },
);

pmmTest(
  'PMM-T2202 - Verify PMM new version on percona.com/downloads @post-release @downloads',
  async ({ downloadsPage }) => {
    await downloadsPage.open();
    await downloadsPage.selectPmmProduct();

    await pmmTest.step('Verify the new version is displayed', async () => {
      await expect(downloadsPage.elements.versionSelect).toHaveValue(expectedVersion, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    await pmmTest.step('Verify the list of available OSes with packages is not empty', async () => {
      const packages = await downloadsPage.getAvailablePackages();

      expect(packages.length, 'There should be downloadable OS packages for PMM').toBeGreaterThan(0);
    });
  },
);
