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
    async ({ page, tour }) => {
        await tour.getLocator('startTourButton').click();

        for (let i = 0; i < titles.length - 1; i++) {
            const cardTitle = await tour.getLocator('stepTitle').innerText();
            expect(cardTitle).toBe(titles[i]);
            if (i < titles.length - 1) {
                await tour.getLocator('nextTip').click();
            }
        }

        await tour.getLocator('endTourButton').click();
        await expect(tour.getLocator('stepTitle')).toBeHidden();
    });

pmmTest('verify previous button from card 8 -> 2',
    async ({ tour }) => {
        await tour.getLocator('startTourButton').click();
        await tour.forwardTour(titles.length);
        for (let i = titles.length - 1; i > 0; i--) {
            const cardTitle = await tour.getLocator('stepTitle').innerText();
            expect(cardTitle).toBe(titles[i]);
            if (i > 0) {
                await tour.getLocator('previousTip').click();
            }
        }
    }
)

pmmTest('PMM-2125 verify close tour on random card',
    async ({ tour }) => {
        await tour.getLocator('startTourButton').click();
        const randomCard = Math.floor(Math.random() * titles.length);
        await tour.forwardTour(randomCard);
        await tour.getLocator('closeButton').click();
        await expect(tour.getLocator('stepTitle')).not.toBeVisible();
    })