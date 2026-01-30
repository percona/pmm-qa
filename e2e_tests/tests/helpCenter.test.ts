import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('PMM-T2098 - Verify view docs button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.viewDocs).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.viewDocs);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/docs.percona.com/');
  });
});

pmmTest('PMM-T2116 - Verify Get Percona Support button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.contactSupport).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.contactSupport);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/www.percona.com/about/contact');
  });
});

pmmTest('PMM-T2117 - Verify view forum button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.viewForum).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.viewForum);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/forums.percona.com/');
  });
});

pmmTest('PMM-T2118 - Verify manage datasets button @new-navigation', async ({ helpPage, page }) => {
  await pmmTest.step('Verify navigation to internal URL', async () => {
    await expect(helpPage.buttons.manageDatasets).toBeVisible();

    const href = helpPage.buttons.manageDatasets;

    await expect(href).toHaveAttribute('href');
    await helpPage.buttons.manageDatasets.click();
    expect(page.url()).toContain('/graph/pmm-dump');
  });
});

pmmTest('PMM-T2119 - Verify export logs button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify log download', async () => {
    await expect(helpPage.buttons.exportLogs).toBeVisible();

    const href = helpPage.buttons.exportLogs;

    await expect(href).toHaveAttribute('href');

    const download = await helpPage.exportLogs();

    expect(download).toBeTruthy();
  });
});

pmmTest('PMM-T2120 - Verify start pmm tour button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify starting PMM tour', async () => {
    await expect(helpPage.buttons.startPmmTour).toBeVisible();
    await helpPage.buttons.startPmmTour.click();
    await expect(helpPage.buttons.nextTip).toBeVisible();
  });
});

pmmTest('PMM-T2121 - Verify share your thoughts button @new-navigation', async ({ helpPage }) => {
  await pmmTest.step('Verify navigation to external URL', async () => {
    await expect(helpPage.buttons.shareYourThoughts).toBeVisible();

    const { href, newTab } = await helpPage.clickExternalLink(helpPage.buttons.shareYourThoughts);

    expect(href).toBeTruthy();
    expect(newTab.url()).toContain('/docs.google.com/forms/');
  });
});
