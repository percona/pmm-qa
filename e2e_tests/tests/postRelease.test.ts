import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

const expectedVersion = process.env.PMM_SERVER_LATEST?.trim() as string;

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
    await updatesPage.openHomeForUpdateModal();

    await pmmTest.step('Verify Release Notes link is displayed in the update modal', async () => {
      await expect(updatesPage.elements.updateModalTitle).toContainText(expectedVersion);
      await expect(updatesPage.buttons.releaseNotes).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(updatesPage.buttons.releaseNotes).toHaveAttribute(
        'href',
        new RegExp(`per\\.co\\.na/pmm/${expectedVersion.replaceAll('.', '\\.')}`),
      );
    });

    await pmmTest.step('Open release notes and verify the released version', async () => {
      const { href, newTab } = await updatesPage.clickReleaseNotes(updatesPage.buttons.releaseNotes);

      expect(href, 'Release Notes link should point to the GA release notes URL').toMatch(
        new RegExp(`per\\.co\\.na/pmm/${expectedVersion.replaceAll('.', '\\.')}`),
      );
      await newTab.waitForLoadState();
      expect(newTab.url(), 'Release notes should open Percona documentation').toMatch(
        /per\.co\.na|percona\.com|docs\.percona\.com/,
      );
      expect(newTab.url(), 'Release notes page should reference the released version').toContain(
        expectedVersion,
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
