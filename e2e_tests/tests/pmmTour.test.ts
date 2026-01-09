import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";
import TourPage from "@pages/tour.page";

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

const titles = TourPage.titles;

pmmTest('PMM-T2100 verify onboarding tour functionality (PMM start tour) @new-navigation', async ({ tour }) => {
  await pmmTest.step('Start tour', async () => {
    await tour.startTour();
  });

  await pmmTest.step('Verify tour steps', async () => {
    for (let i = 0; i < titles.length; i++) {
      await expect(tour.elements().stepTitle()).toHaveText(titles[i]);
      if (i < titles.length - 1) {
        await tour.nextStep();
      }
    }
  });

  await pmmTest.step('End tour', async () => {
    await tour.endTour();
    await expect(tour.elements().stepTitle()).toBeHidden();
  });
});

pmmTest('verify previous button from card 8 -> 2 @new-navigation', async ({ tour }) => {
  await pmmTest.step('Start tour and go to the last step', async () => {
    await tour.startTour();
    await tour.navigateForward(titles.length - 1);
  });

  await pmmTest.step('Verify tour backward from last step', async () => {
    for (let i = titles.length - 1; i >= 0; i--) {
      await expect(tour.elements().stepTitle()).toHaveText(titles[i]);
      if (i > 0) {
        await tour.previousStep();
      }
    }
  });
});

pmmTest('PMM-2125 verify close tour on random card @new-navigation', async ({ tour }) => {
  await pmmTest.step('Start tour', async () => {
    await tour.startTour();
  });

  const stepsToMove = Math.floor(Math.random() * titles.length);
  await pmmTest.step('Go to a random card', async () => {
    await tour.navigateForward(stepsToMove);
  });

  await pmmTest.step('Close tour', async () => {
    await tour.closeTour();
    await expect(tour.elements().stepTitle()).not.toBeVisible();
  });
});