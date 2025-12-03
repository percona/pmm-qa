import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify view docs button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.viewDocsButton);
    const href = await helpPage.getButtonHref(helpPage.viewDocsButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const newTab = await helpPage.openViewDocs();
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2116 - Verify Get Percona Support button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.contactSupportButton);
    const href = await helpPage.getButtonHref(helpPage.contactSupportButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const newTab = await helpPage.openContactSupport();
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2117 - Verify view forum button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.viewForumButton);
    const href = await helpPage.getButtonHref(helpPage.viewForumButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const newTab = await helpPage.openViewForum();
    expect(newTab).toBeTruthy();
});

pmmTest('PMM-T2118 - Verify manage datasets button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.manageDatasetsButton);
    const href = await helpPage.getButtonHref(helpPage.manageDatasetsButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const helpPageUrl = helpPage.page.url();
    await helpPage.clickManageDatasets();
    expect(helpPage.page.url()).not.toBe(helpPageUrl);
});

pmmTest('PMM-T2119 - Verify export logs button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.exportLogsButton);
    const href = await helpPage.getButtonHref(helpPage.exportLogsButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const download = await helpPage.exportLogs();
    expect(download).toBeTruthy();
});

pmmTest('PMM-T2120 - Verify start pmm tour button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.startPmmTourButton);
    await helpPage.clickStartPmmTour();
});

pmmTest('PMM-T2121 - Verify share your thoughts button', async ({ helpPage }) => {
    await helpPage.verifyButtonVisible(helpPage.shareYourThoughtsButton);
    const href = await helpPage.getButtonHref(helpPage.shareYourThoughtsButton);
    expect(href).toBeTruthy();
    if (href) await helpPage.verifyLinkResponseStatus(href, 200);
    const newTab = await helpPage.openShareYourThoughts();
    expect(newTab).toBeTruthy();
});
