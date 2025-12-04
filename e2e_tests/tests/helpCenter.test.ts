import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify view docs button', async ({ helpPage, page }) => {
    const viewDocsButton = helpPage.getLocator('viewDocsButton');
    await expect(viewDocsButton).toBeVisible();
    const href = await viewDocsButton.getAttribute('href');
    expect(href).toContain('per.co.na/pmm_documentation');
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const popup = page.waitForEvent('popup');
    await viewDocsButton.click();
    const newTab = await popup;
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2116 - Verify Get Percona Support button', async ({ helpPage, page }) => {
    const contactSupportButton = helpPage.getLocator('contactSupportButton');
    await expect(contactSupportButton).toBeVisible();
    const href = await contactSupportButton.getAttribute('href');
    expect(href).toContain('percona.com/about/contact');
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const popup = page.waitForEvent('popup');
    await contactSupportButton.click();
    const newTab = await popup;
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2117 - Verify view forum button', async ({ helpPage, page }) => {
    const viewForumButton = helpPage.getLocator('viewForumButton');
    await expect(viewForumButton).toBeVisible();
    const href = await viewForumButton.getAttribute('href');
    expect(href).toContain('per.co.na/PMM3_forum');
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const popup = page.waitForEvent('popup');
    await viewForumButton.click();
    const newTab = await popup;
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2118 - Verify manage datasets button', async ({ helpPage, page }) => {
    const manageDatasetsButton = helpPage.getLocator('manageDatasetsButton');
    await expect(manageDatasetsButton).toBeVisible();
    const href = await manageDatasetsButton.getAttribute('href');
    expect(href).toContain('pmm-ui/next/graph/pmm-dump');
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const pageUrl = page.url();
    await manageDatasetsButton.click();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toBe(pageUrl);
});

pmmTest('PMM-T2119 - Verify export logs button', async ({ helpPage, page }) => {
    const exportLogsButton = helpPage.getLocator('exportLogsButton');
    await expect(exportLogsButton).toBeVisible();
    const href = await exportLogsButton.getAttribute('href');
    expect(href).toBeTruthy();
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const download = await helpPage.exportLogs();
    expect(download).toBeTruthy();
});

pmmTest('PMM-T2120 - Verify start pmm tour button', async ({ helpPage }) => {
    const startPmmTourButton = helpPage.getLocator('startPmmTourButton');
    await expect(startPmmTourButton).toBeVisible();
    await helpPage.clickStartPmmTour();
});

pmmTest('PMM-T2121 - Verify share your thoughts button', async ({ helpPage, page }) => {
    const shareYourThoughtsButton = helpPage.getLocator('shareYourThoughtsButton');
    await expect(shareYourThoughtsButton).toBeVisible();
    const href = await shareYourThoughtsButton.getAttribute('href');
    expect(href).toContain('per.co.na/pmm3_feedback');
    if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
    }
    const popup = page.waitForEvent('popup');
    await shareYourThoughtsButton.click();
    const newTab = await popup;
    expect(newTab).toBeTruthy();
});
