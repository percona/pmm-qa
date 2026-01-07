import { Page, Locator } from '@playwright/test';

export default class TourPage {
    public static readonly titles = [
        'Percona Dashboards',
        'Query Analytics (QAN) dashboard',
        'Explore',
        'Alerts & Percona Templates',
        'Percona Advisors',
        'Management: Inventory & Backups',
        'Configurations',
        'Help Center'
    ];

    constructor(public page: Page) { }

    public get elements() {
        return {
            startTourButton: this.page.getByTestId('tips-card-start-product-tour-button'),
            nextTip: this.page.getByTestId('tour-next-step-button'),
            previousTip: this.page.getByTestId('tour-previous-step-button'),
            endTourButton: this.page.getByTestId('tour-end-tour-button'),
            closeButton: this.page.getByTestId('tour-close-button'),
            stepTitle: this.page.getByTestId('tour-step-title'),
        };
    }

    public async startTour(): Promise<void> {
        await this.elements.startTourButton.click();
    }

    public async nextStep(): Promise<void> {
        await this.elements.nextTip.click();
    }

    public async previousStep(): Promise<void> {
        await this.elements.previousTip.click();
    }

    public async endTour(): Promise<void> {
        await this.elements.endTourButton.click();
    }

    public async closeTour(): Promise<void> {
        await this.elements.closeButton.click();
    }

    public async navigateForward(stepsToMove: number): Promise<void> {
        for (let i = 0; i < stepsToMove; i++) {
            await this.nextStep();
        }
    }

    public async getStepTitle(): Promise<string> {
        return (await this.elements.stepTitle.innerText());
    }
}
    