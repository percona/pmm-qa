import { Page, Locator } from '@playwright/test';

export default class TourPage {
    constructor(private page: Page) { }

    private elements = {
        startTourButton: '//*[@data-testid="tips-card-start-product-tour-button"]',
        nextTip: '//*[@data-testid="tour-next-step-button"]',
        previousTip: '//*[@data-testid="tour-previous-step-button"]',
        endTourButton: '//*[@data-testid="tour-end-tour-button"]',
        closeButton: '//*[@data-testid="tour-close-button"]',
        stepTitle: '//*[@data-testid="tour-step-title"]',
    }

    getLocator(locator: keyof TourPage['elements']) {
        return this.page.locator(this.elements[locator]);
    }

    async forwardTour(tips: number) {
        for (let i = 0; i < tips - 1; i++) {
            await this.getLocator('nextTip').click();
        }
    }
}
