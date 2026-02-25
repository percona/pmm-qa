import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeEach(async ({ grafanaHelper, page, rtaOverview }) => {
  await page.goto('');
  await grafanaHelper.authorize();
  await rtaOverview.startMonitoringClusterService();
});

pmmTest(
  'PMM-T2166 Verify auto refresh dropdown, default value &interval behavior @rta',
  async ({ page, rtaOverview }) => {
    await pmmTest.step('Verify auto-refresh dropdown is visible and default is 2s', async () => {
      await expect(rtaOverview.buttons.autoRefreshDropdown).toContainText('2s');
    });

    await pmmTest.step('Verify auto-refresh has the required interval options', async () => {
      await rtaOverview.buttons.autoRefreshDropdown.click();

      for (const interval of rtaOverview.refreshIntervals) {
        await expect(page.getByRole('menuitem', { name: interval })).toBeVisible();
      }

      await page.keyboard.press('Escape');
    });

    await pmmTest.step('Verify default 2s interval', async () => {
      const isTwoSecondInterval = await rtaOverview.verifyRequestInterval(
        2 * Timeouts.ONE_SECOND,
        200,
        10 * Timeouts.ONE_SECOND,
        2,
      );

      expect(isTwoSecondInterval).toBeTruthy();
    });
  },
);

pmmTest('PMM-T2170 verify query refresh interval every 4s @rta', async ({ page, rtaOverview }) => {
  await rtaOverview.buttons.autoRefreshDropdown.click();
  await page.getByRole('menuitem', { name: '4s' }).click();
  await rtaOverview.buttons.resume.click();
  await expect(rtaOverview.buttons.autoRefreshDropdown).toContainText('4s');

  const isFourSecondInterval = await rtaOverview.verifyRequestInterval(
    4 * Timeouts.ONE_SECOND,
    200,
    15 * Timeouts.ONE_SECOND,
    2,
  );

  expect(isFourSecondInterval).toBeTruthy();
});

pmmTest('PMM-T2167 Verify rta pause when hovered over overview table @rta', async ({ rtaOverview }) => {
  await pmmTest.step('Hover first overview row and verify auto-refresh is paused', async () => {
    const firstRow = rtaOverview.elements.overviewTableBody.locator('tr').first();

    await expect(firstRow).toBeVisible();
    await firstRow.hover();
    await expect(rtaOverview.buttons.refresh).toBeVisible();
    await expect(rtaOverview.buttons.resume).toBeVisible();

    const count = await rtaOverview.getApiRequestCount(6 * Timeouts.ONE_SECOND);

    expect(count).toBe(0);
  });
});
