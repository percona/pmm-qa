import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('');
    await grafanaHelper.authorize();
});

pmmTest('PMM-T2096 - Verify view docs button', async ({ helpPage, page }) => {
    const viewDocsButton = helpPage.elements().viewDocsButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(viewDocsButton()).toBeVisible();
        const href = await viewDocsButton().getAttribute('href');

        if (href) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
        }
    });

    await pmmTest.step('Verify navigation to external URL', async () => {
        const popup = page.waitForEvent('popup');
        await helpPage.clickElement(viewDocsButton());
        const newTab = await popup;
        expect(newTab.url()).toContain('/docs.percona.com/');
    });
});

pmmTest('PMM-T2116 - Verify Get Percona Support button', async ({ helpPage, page }) => {
    const contactSupportButton = helpPage.elements().contactSupportButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(contactSupportButton()).toBeVisible();
        const href = await contactSupportButton().getAttribute('href');

        if (href) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
        }
    });

    await pmmTest.step('Verify navigation to external URL', async () => {
        const popup = page.waitForEvent('popup');
        await helpPage.clickElement(contactSupportButton());
        const newTab = await popup;
        expect(newTab.url()).toContain('/www.percona.com/about/contact');
    });
});

pmmTest('PMM-T2117 - Verify view forum button', async ({ helpPage, page }) => {
    const viewForumButton = helpPage.elements().viewForumButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(viewForumButton()).toBeVisible();
        const href = await viewForumButton().getAttribute('href');

        if (href) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
        }
    });

    await pmmTest.step('Verify navigation to external URL', async () => {
        const popup = page.waitForEvent('popup');
        await helpPage.clickElement(viewForumButton());
        const newTab = await popup;
        expect(newTab.url()).toContain('/forums.percona.com/');
    });
});

pmmTest('PMM-T2118 - Verify manage datasets button', async ({ helpPage, page }) => {
    const manageDatasetsButton = helpPage.elements().manageDatasetsButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(manageDatasetsButton()).toBeVisible();
        const href = await manageDatasetsButton().getAttribute('href');

        if (href) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
        }
    });

    await pmmTest.step('Verify navigation to internal URL', async () => {
        await helpPage.clickElement(manageDatasetsButton());
        expect(page.url()).toContain('/graph/pmm-dump');
    });
});

pmmTest('PMM-T2119 - Verify export logs button', async ({ helpPage, page }) => {
    const exportLogsButton = helpPage.elements().exportLogsButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(exportLogsButton()).toBeVisible();
        const href = await exportLogsButton().getAttribute('href');
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

pmmTest('PMM-T2120 - Verify start pmm tour button', async ({ helpPage }) => {
    const startPmmTourButton = helpPage.elements().startPmmTourButton;

    await pmmTest.step('Verify button visibility', async () => {
        await expect(startPmmTourButton()).toBeVisible();
    });

    await pmmTest.step('Verify starting PMM tour', async () => {
        await helpPage.clickStartPmmTour();
        await expect(helpPage.elements().nextTipButton()).toBeVisible();
    });
});

pmmTest('PMM-T2121 - Verify share your thoughts button', async ({ helpPage, page }) => {
    const shareYourThoughtsButton = helpPage.elements().shareYourThoughtsButton;

    await pmmTest.step('Verify button visibility and response status', async () => {
        await expect(shareYourThoughtsButton()).toBeVisible();
        const href = await shareYourThoughtsButton().getAttribute('href');

        if (href) {
            const response = await page.request.get(href);
            expect(response.status()).toBe(200);
        }
    });

    await pmmTest.step('Verify navigation to external URL', async () => {
        const popup = page.waitForEvent('popup');
        await helpPage.clickElement(shareYourThoughtsButton());
        const newTab = await popup;
        expect(newTab.url()).toContain('/docs.google.com/forms/');
    });
});
