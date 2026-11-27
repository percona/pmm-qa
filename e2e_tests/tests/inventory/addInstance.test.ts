import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1106 - Verify the name RDS button on Add instance page @fb-instances',
  async ({ addInstancePage, page }) => {
    await page.goto(addInstancePage.url);
    await expect(addInstancePage.buttons.rds).toBeVisible({ timeout: Timeouts.TWO_MINUTES });
    await expect(addInstancePage.elements.rdsHeading).toHaveText('Amazon RDS');
  },
);
