import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify view docs button', async ({ helpPage }) => {
    const viewDocsButton = helpPage.getLocator('viewDocsButton');
    await helpPage.ValidateExternalUrl(
        viewDocsButton, '/docs.percona.com/');
});

pmmTest('PMM-T2116 - Verify Get Percona Support button', async ({ helpPage }) => {
    const contactSupportButton = helpPage.getLocator('contactSupportButton');
    await helpPage.ValidateExternalUrl(
        contactSupportButton, '/www.percona.com/about/contact');
});

pmmTest('PMM-T2117 - Verify view forum button', async ({ helpPage }) => {
    const viewForumButton = helpPage.getLocator('viewForumButton');
    await helpPage.ValidateExternalUrl(
        viewForumButton, '/forums.percona.com/');
});

pmmTest('PMM-T2118 - Verify manage datasets button', async ({ helpPage }) => {
    const manageDatasetsButton = helpPage.getLocator('manageDatasetsButton');
    await helpPage.ValidateInternalUrl(
        manageDatasetsButton, '/graph/pmm-dump');
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

pmmTest('PMM-T2121 - Verify share your thoughts button', async ({ helpPage }) => {
    const shareYourThoughtsButton = helpPage.getLocator('shareYourThoughtsButton');
    await helpPage.ValidateExternalUrl(
        shareYourThoughtsButton, '/docs.google.com/forms/');
});
