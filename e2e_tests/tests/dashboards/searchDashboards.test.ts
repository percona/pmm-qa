import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { FOLDER_DASHBOARDS } from '@testdata/dashboards.registry';

pmmTest.beforeEach(async ({ grafanaHelper, page, searchDashboardsPage }) => {
  await grafanaHelper.authorize();
  await page.goto(searchDashboardsPage.url);
  await expect(searchDashboardsPage.inputs.search).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
});

pmmTest(
  'PMM-T1091 - Verify PMM Dashboards folders are correct @nightly  @dashboards',
  async ({ searchDashboardsPage }) => {
    await expect
      .poll(async () => (await searchDashboardsPage.elements.rows.allTextContents()).sort(), {
        message: 'The dashboards page must list exactly the folders PMM ships',
        timeout: Timeouts.TEN_SECONDS,
      })
      .toEqual([...FOLDER_DASHBOARDS.map((folder) => folder.name), 'MySQL'].sort());
  },
);

for (const folder of FOLDER_DASHBOARDS) {
  pmmTest(
    `PMM-T1086 - Verify PMM Dashboards collections are present in correct folders @nightly  @dashboards @post-upgrade | ${folder.name}`,
    async ({ page, searchDashboardsPage }) => {
      await pmmTest.step(`Expand the "${folder.name}" folder`, async () => {
        await searchDashboardsPage.builders.expandFolderButton(folder.name).click();
        await expect(searchDashboardsPage.builders.collapseFolderButton(folder.name)).toBeVisible({
          timeout: Timeouts.TEN_SECONDS,
        });
      });

      await pmmTest.step(`Verify every "${folder.name}" dashboard is listed in the folder`, async () => {
        for (const dashboardName of folder.dashboards) {
          const row = searchDashboardsPage.builders.dashboardRow(dashboardName);

          await expect(async () => {
            if (!(await row.isVisible())) await page.keyboard.press('PageDown');

            await expect(row).toContainText(dashboardName, { timeout: Timeouts.ONE_SECOND });
          }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.TEN_SECONDS });
        }
      });
    },
  );
}
