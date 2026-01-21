import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});


pmmTest('PMM-T2132 Verify welcome Card appears on fresh install @new-navigation', async ({ welcomePage, mocks }) => {
  await pmmTest.step('Mock fresh install and no services', async () => {
    await mocks.mockFreshInstall();
    await mocks.mockNoServices();
  });
  await pmmTest.step('Verify welcome card and its buttons are visible', async () => {
    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await expect(welcomePage.buttons.addServiceButton).toBeVisible();
    await expect(welcomePage.buttons.dismissButton).toBeVisible();
    await expect(welcomePage.buttons.startTourButton).toBeVisible();
  });
});

pmmTest('PMM-T2101 verify dismiss button on welcome card @new-navigation', async ({ page, welcomePage, mocks }) => {
  await pmmTest.step('Mock fresh install', async () => {
    await mocks.mockFreshInstall();
  });
  await pmmTest.step('Verify welcome card visibility and click dismiss', async () => {
    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await welcomePage.buttons.dismissButton.click();
  });
  await pmmTest.step('Reload page and verify welcome card is not visible', async () => {
    await page.reload();
    await expect(welcomePage.elements.welcomeCard).toBeHidden();
  });
});

pmmTest('PMM-T2133 Verify Welcome Card start tour @new-navigation', async ({ page, welcomePage, mocks }) => {
  await pmmTest.step('Mock fresh install', async () => {
    await mocks.mockFreshInstall();
  });
  await pmmTest.step('Verify welcome card and start tour', async () => {
    await expect(welcomePage.elements.welcomeCard).toBeVisible();
    await welcomePage.buttons.startTourButton.click();
  });
  await pmmTest.step('Verify tour popover and close tour', async () => {
    await expect(welcomePage.elements.tourPopover).toBeVisible();
    await welcomePage.buttons.tourCloseButton.click();
  });
  await pmmTest.step('Reload page and verify welcome card is not visible', async () => {
    await page.reload();
    await expect(welcomePage.elements.welcomeCard).toBeHidden();
  });
});

pmmTest('PMM-T2134 Verify Update check @new-navigation', async ({ page, welcomePage, mocks }) => {

  const cases = welcomePage.cases;
  for (const c of cases) {
    await pmmTest.step('Verify update check', async () => {
      await welcomePage.mockUpdateAvailable(
        c.updateAvailable
      );
      await page.reload();
      if (c.updateAvailable) {
        await expect(welcomePage.buttons.updates).toBeVisible({ timeout: 10000 });
      } else {
        await expect(welcomePage.buttons.updates).toBeHidden({ timeout: 10000 });
      }
    });
  }
});
