
import { Page, Locator, expect } from '@playwright/test';

export default class HelpPage {
    readonly page: Page;

    readonly viewDocsButton: Locator;
    readonly contactSupportButton: Locator;
    readonly viewForumButton: Locator;
    readonly manageDatasetsButton: Locator;
    readonly exportLogsButton: Locator;
    readonly startPmmTourButton: Locator;
    readonly shareYourThoughtsButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.viewDocsButton = page.getByRole('link', { name: 'View docs' });
        this.contactSupportButton = page.getByRole('link', { name: 'Contact Support' });
        this.viewForumButton = page.getByRole('link', { name: 'View forum' });
        this.manageDatasetsButton = page.getByRole('link', { name: 'Manage datasets' });
        this.exportLogsButton = page.getByRole('link', { name: 'Export logs' });
        this.startPmmTourButton = page.getByTestId('tips-card-start-product-tour-button');
        this.shareYourThoughtsButton = page.getByRole('link', { name: 'Share your thoughts' });
    }

    async verifyButtonVisible(button: Locator) {
        await expect(button).toBeVisible();
    }

    async getButtonHref(button: Locator) {
        return await button.getAttribute('href');
    }

    async verifyLinkResponseStatus(url: string, expected = 200) {
        const response = await this.page.request.get(url);
        expect(response.status()).toBe(expected);
        return response;
    }

    async newTabOpen(button: Locator) {
        const popup = this.page.waitForEvent('popup');
        await button.click();
        return await popup;
    }

    async openViewDocs() {
        return await this.newTabOpen(this.viewDocsButton);
    }

    async openContactSupport() {
        return await this.newTabOpen(this.contactSupportButton);
    }

    async openViewForum() {
        return await this.newTabOpen(this.viewForumButton);
    }

    async clickManageDatasets() {
        await this.manageDatasetsButton.click();
        await this.page.waitForLoadState('domcontentloaded');
    }

    async exportLogs() {
        const download = this.page.waitForEvent('download');
        await this.exportLogsButton.click();
        return download;
    }

    async clickStartPmmTour() {
        await this.startPmmTourButton.click();
        const nextTipButton = this.page.getByTestId('tour-next-step-button');
        await expect(nextTipButton).toBeVisible();
        return nextTipButton;
    }

    async openShareYourThoughts() {
        return await this.newTabOpen(this.shareYourThoughtsButton);
    }

}
