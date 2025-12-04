import { expect, Page } from '@playwright/test';

export default class HelpPage {
    constructor(private page: Page) { }

    private elements = {
        viewDocsButton: '//*[@data-testid="help-card-pmm-docs"]//a',
        contactSupportButton: '//*[@data-testid="help-card-support"]//a',
        viewForumButton: '//*[@data-testid="help-card-forum"]//a',
        manageDatasetsButton: '//*[@data-testid="help-card-pmm-dump"]//a',
        exportLogsButton: '//*[@data-testid="help-card-pmm-logs"]//a',
        startPmmTourButton: '//*[@data-testid="tips-card-start-product-tour-button"]',
        shareYourThoughtsButton: '//*[@data-testid="help-card-next-chapter"]//a',
        nextTipButton: '//*[@data-testid="tour-next-step-button"]',
    };

    getLocator = (elementKey: keyof typeof this.elements) => {
        return this.page.locator(this.elements[elementKey]);
    };


    exportLogs = async () => {
        const download = this.page.waitForEvent('download');
        await this.page.locator(this.elements.exportLogsButton).click();
        return download;
    };

    clickStartPmmTour = async () => {
        await this.page.locator(this.elements.startPmmTourButton).click();
        await expect(this.page.locator(this.elements.nextTipButton)).toBeVisible();
        return this.page.locator(this.elements.nextTipButton);
    };
}
