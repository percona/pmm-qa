import { Page, expect } from '@playwright/test';

export default class TourPage {
    constructor(public page: Page) { }

    public get elements() {
        return {
            startTourButton: this.page.locator('//*[@data-testid="tips-card-start-product-tour-button"]'),
            nextTip: this.page.locator('//*[@data-testid="tour-next-step-button"]'),
            previousTip: this.page.locator('//*[@data-testid="tour-previous-step-button"]'),
            endTourButton: this.page.locator('//*[@data-testid="tour-end-tour-button"]'),
            closeButton: this.page.locator('//*[@data-testid="tour-close-button"]'),
            stepTitle: this.page.locator('//*[@data-testid="tour-step-title"]'),
        }
    }

    async forwardTour(tips: number) {
        for (let i = 0; i < tips - 1; i++) {
            await this.elements.nextTip.click();
        }
    }

    async tourSteps(titles: string[]) {
        for (let i = 0; i < titles.length - 1; i++) {
            const cardTitle = await this.elements.stepTitle.innerText();
            expect(cardTitle).toBe(titles[i]);
            if (i < titles.length - 1) {
                await this.elements.nextTip.click();
            }
        }
    }

    async tourBackward(titles: string[]) {
        for (let i = titles.length - 1; i > 0; i--) {
            const cardTitle = await this.elements.stepTitle.innerText();
            expect(cardTitle).toBe(titles[i]);
            if (i > 0) {
                await this.elements.previousTip.click();
            }
        }
    }
}
