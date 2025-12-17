import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
    await page.goto('')
    await grafanaHelper.authorize();
    await page.waitForLoadState('domcontentloaded');
});

const titles = [
    'Percona Dashboards',
    'Query Analytics (QAN) dashboard',
    'Explore',
    'Alerts & Percona Templates',
    'Percona Advisors',
    'Management: Inventory & Backups',
    'Configurations',
    'Help Center'
]

pmmTest('PMM-T2100 verify onboarding tour functionality (PMM start tour)',
    async ({ tour }) => {
        await tour.elements.startTourButton.click();
        await tour.tourSteps(titles);
        await tour.elements.endTourButton.click();
        await expect(tour.elements.stepTitle).toBeHidden();
    });

pmmTest('verify previous button from card 8 -> 2',
    async ({ tour }) => {
        await tour.elements.startTourButton.click();
        await tour.forwardTour(titles.length);
        await tour.tourBackward(titles);
    }
)

pmmTest('PMM-2125 verify close tour on random card',
    async ({ tour }) => {
        await tour.elements.startTourButton.click();
        const randomCard = Math.floor(Math.random() * titles.length);
        await tour.forwardTour(randomCard);
        await tour.elements.closeButton.click();
        await expect(tour.elements.stepTitle).not.toBeVisible();
    })