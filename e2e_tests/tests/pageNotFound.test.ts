import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-Txxxx - Verify page not found is shown for an unknown PMM UI address @new-navigation',
  async ({ page, pageNotFoundPage }) => {
    for (const url of pageNotFoundPage.unknownUrls) {
      await pmmTest.step(`Verify page not found for ${url}`, async () => {
        await page.goto(url);

        await expect(pageNotFoundPage.elements.heading).toBeVisible();
        await expect(pageNotFoundPage.messages.description).toBeVisible();
        await expect(pageNotFoundPage.buttons.goHome).toBeVisible();
        await expect(pageNotFoundPage.buttons.goBack).toBeHidden();
        await expect(pageNotFoundPage.elements.footer).toBeHidden();
        await expect(page).toHaveTitle(pageNotFoundPage.documentTitle);
      });
    }
  },
);

pmmTest(
  'PMM-Txxxx - Verify Go to Home page button on page not found opens the Home dashboard @new-navigation',
  async ({ page, pageNotFoundPage }) => {
    await page.goto(pageNotFoundPage.url);
    await pageNotFoundPage.buttons.goHome.click();

    await expect(page).toHaveURL(pageNotFoundPage.homeUrl);
    await expect(pageNotFoundPage.elements.heading).toBeHidden();
  },
);

pmmTest(
  'PMM-Txxxx - Verify Go back button on page not found returns to the previous page @new-navigation',
  async ({ helpPage, page, pageNotFoundPage }) => {
    await pmmTest.step('Open Help and navigate in-app to an unknown address', async () => {
      await page.goto(helpPage.url);
      await expect(helpPage.buttons.viewDocs).toBeVisible();
      await pageNotFoundPage.navigateInApp(pageNotFoundPage.url);
      await expect(pageNotFoundPage.elements.heading).toBeVisible();
    });

    await pmmTest.step('Go back to Help', async () => {
      await pageNotFoundPage.buttons.goBack.click();

      await expect(page).toHaveURL(helpPage.url);
      await expect(helpPage.buttons.viewDocs).toBeVisible();
    });
  },
);
