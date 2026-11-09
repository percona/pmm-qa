import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest(
  'PMM-T2514 - Verify the Alerting tour for Admin shows one tip per Alerts menu item, in menu order, each highlighting its item @fb-alerting',
  async ({ grafanaHelper, leftNavigation, mocks, page, tour }) => {
    const tips = tour.alertingTips;
    const alertingTour = await mocks.mockAlertingTourNotCompleted();

    await grafanaHelper.authorize();
    // The home dashboard's late redirect can undo the click on Alerts, so start from a page without one
    await page.goto('pmm-ui/help');
    await expect(tour.buttons.startTour).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    await pmmTest.step('Open Alerts and verify the menu and the first tip', async () => {
      await leftNavigation.menuItemLocator('alerts').click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(page).toHaveURL(/\/graph\/alerting\//);

      for (const tip of tips) {
        await expect(tour.builders.alertingMenuItem(tip.menuItem)).toHaveText(tip.title);
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
          .toBe(tip.menuItem);

        await expect(tour.elements.stepBody).toContainText(tip.text ?? '');
      }

      await expect(tour.buttons.nextTip).toBeHidden();
      await expect(tour.buttons.endTour).toBeVisible();
    });

    await pmmTest.step('Go back through every tip', async () => {
      for (let index = tips.length - 1; index >= 0; index--) {
        if (index < tips.length - 1) await tour.buttons.previousTip.click();

        await expect(tour.elements.stepTitle).toHaveText(tips[index].title);
        await expect(tour.elements.popover).not.toContainText(tour.removedAlertingTip);
        await expect.poll(tour.getHighlightedMenuItem).toBe(tips[index].menuItem);
      }

      await expect(tour.buttons.previousTip).toBeHidden();
    });

    await pmmTest.step('Close the tour and verify it does not reopen after a reload', async () => {
      await tour.buttons.close.click();
      await expect(tour.elements.popover).toBeHidden();
      await expect.poll(alertingTour.completed, { message: 'The tour is saved as completed' }).toBe(true);

      const userLoaded = page.waitForResponse(apiEndpoints.users.me);

      await page.reload();
      await userLoaded;
      await expect(leftNavigation.menuItemLocator('alerts.alertRules')).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect(tour.elements.popover).toBeHidden();
    });
  },
);
