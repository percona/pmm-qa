import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest(
  'PMM-T2514 - Verify the Alerting tour for Admin shows one tip per Alerts menu item, in menu order, each highlighting its item @fb-alerting',
  async ({ grafanaHelper, leftNavigation, mocks, page, tour }) => {
    const tips = tour.alertingTips;

    await mocks.mockAlertingTourNotCompleted();
    await grafanaHelper.authorize();
    await page.goto('pmm-ui/help');
    await expect(tour.buttons.startTour).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    await pmmTest.step('Open Alerts and verify the menu and the first tip', async () => {
      await leftNavigation.menuItemLocator('alerts').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(page).toHaveURL(/\/graph\/alerting\//);

      for (const tip of tips) {
        await expect(leftNavigation.menuItemLocator(tip.navItem)).toHaveText(tip.title);
      }

      await expect(tour.builders.counter(1, tips.length)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Go forward through every tip', async () => {
      for (const [index, tip] of tips.entries()) {
        if (index > 0) await tour.buttons.nextTip.click();

        await expect(tour.builders.counter(index + 1, tips.length)).toBeVisible();
        await expect(tour.elements.stepTitle).toHaveText(tip.title);
        await expect
          .poll(tour.getHighlightedMenuItem, { message: `"${tip.title}" highlights its item` })
          .toBe(tip.highlighted);

        await expect(tour.elements.stepBody).toContainText(tip.text);
      }

      await expect(tour.buttons.nextTip).toBeHidden();
      await expect(tour.buttons.endTour).toBeVisible();
    });

    await pmmTest.step('Go back through every tip', async () => {
      for (let index = tips.length - 1; index >= 0; index--) {
        if (index < tips.length - 1) await tour.buttons.previousTip.click();

        await expect(tour.elements.stepTitle).toHaveText(tips[index].title);
        await expect(leftNavigation.elements.tourPopover).not.toContainText(tour.removedAlertingTip);
        await expect.poll(tour.getHighlightedMenuItem).toBe(tips[index].highlighted);
      }

      await expect(tour.buttons.previousTip).toBeHidden();
    });

    await pmmTest.step('Close the tour and verify it does not reopen after a reload', async () => {
      const completionSaved = page.waitForRequest(
        (request) => request.url().endsWith('/v1/users/me') && request.method() !== 'GET',
      );

      await tour.buttons.close.click();
      await completionSaved;
      await expect(leftNavigation.elements.tourPopover).toBeHidden();

      const userLoaded = page.waitForResponse(apiEndpoints.users.me);

      await page.reload();
      await userLoaded;
      await expect(leftNavigation.menuItemLocator('alerts.alertRules')).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(leftNavigation.elements.tourPopover).toBeHidden();
    });
  },
);
