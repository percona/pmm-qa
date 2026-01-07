import { Page, Locator } from '@playwright/test';

export default class HelpPage {
    constructor(public page: Page) { }

    public get elements() {
        return {
            viewDocsButton: this.page.getByRole('link', { name: 'View docs' }),
            contactSupportButton: this.page.getByRole('link', { name: 'Contact Support' }),
            viewForumButton: this.page.getByRole('link', { name: 'View forum' }),
            manageDatasetsButton: this.page.getByRole('link', { name: 'Manage datasets' }),
            exportLogsButton: this.page.getByRole('link', { name: 'Export logs' }),
            startPmmTourButton: this.page.getByTestId('tips-card-start-product-tour-button'),
            shareYourThoughtsButton: this.page.getByRole('link', { name: 'Share your thoughts' }),
            nextTipButton: this.page.getByTestId('tour-next-step-button'),
        };
    }


    public async exportLogs(): Promise<any> {
        const download = this.page.waitForEvent('download');
        await this.elements.exportLogsButton.click();
        return download;
    }

    public async clickElement(element: Locator): Promise<void> {
        await element.click();
    }

    public async clickStartPmmTour(): Promise<Locator> {
        await this.elements.startPmmTourButton.click();
        return this.elements.nextTipButton;
    }


}
