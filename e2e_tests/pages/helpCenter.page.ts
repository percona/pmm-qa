import { expect, Page } from '@playwright/test';

export default class HelpPage {
    constructor(public page: Page) { }

    public get elements() {
        return {
            viewDocsButton: this.page.locator('//*[@data-testid="help-card-pmm-docs"]//a'),
            contactSupportButton: this.page.locator('//*[@data-testid="help-card-support"]//a'),
            viewForumButton: this.page.locator('//*[@data-testid="help-card-forum"]//a'),
            manageDatasetsButton: this.page.locator('//*[@data-testid="help-card-pmm-dump"]//a'),
            exportLogsButton: this.page.locator('//*[@data-testid="help-card-pmm-logs"]//a'),
            startPmmTourButton: this.page.locator('//*[@data-testid="tips-card-start-product-tour-button"]'),
            shareYourThoughtsButton: this.page.locator('//*[@data-testid="help-card-next-chapter"]//a'),
            nextTipButton: this.page.locator('//*[@data-testid="tour-next-step-button"]'),
        };
    }


    exportLogs = async () => {
        const download = this.page.waitForEvent('download');
        await this.elements.exportLogsButton.click();
        return download;
    };

    clickStartPmmTour = async () => {
        await this.elements.startPmmTourButton.click();
        await expect(this.elements.nextTipButton).toBeVisible();
        return this.elements.nextTipButton;
    };

    ValidateExternalUrl = async (button: any, url: string) => {
        await expect(button).toBeVisible();
        const href = await button.getAttribute('href');
        if (href) {
            const response = await this.page.request.get(href);
            expect(response.status()).toBe(200);
        }
        const popup = this.page.waitForEvent('popup');
        await button.click();
        const newTab = await popup;
        expect(newTab.url()).toContain(url);
    }

    ValidateInternalUrl = async (button: any, url: string) => {
        await expect(button).toBeVisible();
        const href = await button.getAttribute('href');
        if (href) {
            const response = await this.page.request.get(href);
            expect(response.status()).toBe(200);
        }
        await button.click();
        expect(this.page.url()).toContain(url);
    }

}
