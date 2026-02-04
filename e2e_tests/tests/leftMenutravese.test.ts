import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest(
  'Traverse all the menu items in left menu sidebar @new-navigation',
  async ({ page, leftNavigation }) => {
    await pmmTest.step('Traverse menu items', async () => {
      await leftNavigation.traverseAllMenuItems(async (locator, res) => {
        await pmmTest.step('click and verify menu items', async () => {
          await expect(locator).toBeVisible({ timeout: 10000 });
          if (res) {
            expect(res.status()).not.toBe(404);
          }
          await expect(page).not.toHaveURL(/404|error|not-found/i);
        });
      });
    });
  },
);
