import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify view docs button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.viewDocsButton()).toBeVisible();
    const href = await helpPage.elements.viewDocsButton().getAttribute('href');

    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify navigation to external URL', async () => {
    const popup = page.waitForEvent('popup');
    await helpPage.elements.viewDocsButton().click();
    const newTab = await popup;
    expect(newTab.url()).toContain('/docs.percona.com/');
  });
});

pmmTest('PMM-T2116 - Verify Get Percona Support button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.contactSupportButton()).toBeVisible();
    const href = await helpPage.elements.contactSupportButton().getAttribute('href');

    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify navigation to external URL', async () => {
    const popup = page.waitForEvent('popup');
    await helpPage.elements.contactSupportButton().click();
    const newTab = await popup;
    expect(newTab.url()).toContain('/www.percona.com/about/contact');
  });
});

pmmTest('PMM-T2117 - Verify view forum button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.viewForumButton()).toBeVisible();
    const href = await helpPage.elements.viewForumButton().getAttribute('href');

    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify navigation to external URL', async () => {
    const popup = page.waitForEvent('popup');
    await helpPage.elements.viewForumButton().click();
    const newTab = await popup;
    expect(newTab.url()).toContain('/forums.percona.com/');
  });
});

pmmTest('PMM-T2118 - Verify manage datasets button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.manageDatasetsButton()).toBeVisible();
    const href = await helpPage.elements.manageDatasetsButton().getAttribute('href');

    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify navigation to internal URL', async () => {
    await helpPage.elements.manageDatasetsButton().click();
    expect(page.url()).toContain('/graph/pmm-dump');
  });
});

pmmTest('PMM-T2119 - Verify export logs button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.exportLogsButton()).toBeVisible();
    const href = await helpPage.elements.exportLogsButton().getAttribute('href');
    expect(href).toBeTruthy();
    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify log download', async () => {
    const download = await helpPage.exportLogs();
    expect(download).toBeTruthy();
  });
});

pmmTest('PMM-T2120 - Verify start pmm tour button @new-navigation', async ({ helpPage }) => {

  await pmmTest.step('Verify button visibility', async () => {
    await expect(helpPage.elements.startPmmTourButton()).toBeVisible();
  });

  await pmmTest.step('Verify starting PMM tour', async () => {
    await helpPage.clickStartPmmTour();
    await expect(helpPage.elements.nextTipButton()).toBeVisible();
  });
});

pmmTest('PMM-T2121 - Verify share your thoughts button @new-navigation', async ({ helpPage, page }) => {

  await pmmTest.step('Verify button visibility and response status', async () => {
    await expect(helpPage.elements.shareYourThoughtsButton()).toBeVisible();
    const href = await helpPage.elements.shareYourThoughtsButton().getAttribute('href');

    if (href) {
      const response = await page.request.get(href);
      expect(response.status()).toBe(200);
    }
  });

  await pmmTest.step('Verify navigation to external URL', async () => {
    const popup = page.waitForEvent('popup');
    await helpPage.elements.shareYourThoughtsButton().click();
    const newTab = await popup;
    expect(newTab.url()).toContain('/docs.google.com/forms/');
  });
});
