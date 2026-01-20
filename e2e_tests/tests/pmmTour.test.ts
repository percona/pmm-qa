import pmmTest from "@fixtures/pmmTest";
import { expect } from "@playwright/test";

pmmTest.beforeEach(async ({ page, grafanaHelper }) => {
  await page.goto('');
  await grafanaHelper.authorize();
});

pmmTest('PMM-T2100 verify onboarding tour functionality (PMM start tour) @new-navigation', async ({ tour }) => {
  await pmmTest.step('Start tour', async () => {
    await tour.buttons.startTour.click();
  });
  await pmmTest.step('Verify all tour steps in sequence', async () => {
    for (let i = 0; i < tour.titles.length; i++) {
      await expect(tour.elements.stepTitle).toHaveText(tour.titles[i]);
      
      const isLastStep = i === tour.titles.length - 1;
      if (!isLastStep) {
        await tour.buttons.nextTip.click();
      }
    }
  });
  await pmmTest.step('End tour', async () => {
    await tour.buttons.endTour.click();
    await expect(tour.elements.stepTitle).toBeHidden();
  });
});

pmmTest('verify previous button from card 8 -> 2 @new-navigation', async ({ tour }) => {
  const lastStepIndex = tour.titles.length - 1;
  await pmmTest.step('Start tour and navigate to last step', async () => {
    await tour.buttons.startTour.click();
    await tour.navigateForward(lastStepIndex);
  });
  await pmmTest.step('Verify backward navigation through all steps', async () => {
    for (let i = lastStepIndex; i >= 0; i--) {
      await expect(tour.elements.stepTitle).toHaveText(tour.titles[i]);
      
      const isFirstStep = i === 0;
      if (!isFirstStep) {
        await tour.buttons.previousTip.click();
      }
    }
  });
});

pmmTest('PMM-2125 verify close tour on random card @new-navigation', async ({ tour }) => {
  const randomStepIndex = Math.floor(Math.random() * tour.titles.length);
  await pmmTest.step('Start tour', async () => {
    await tour.buttons.startTour.click();
  });
  await pmmTest.step('Navigate to random step', async () => {
    await tour.navigateForward(randomStepIndex);
  });
  await pmmTest.step('Close tour and verify it is hidden', async () => {
    await tour.buttons.close.click();
    await expect(tour.elements.stepTitle).toBeHidden();
  });
});
