import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('PMM Advisors tests for upgrade', () => {
  const advisorName = 'Check for unsupported PostgreSQL';
  const groupName = 'Version Configuration';
  const disabledAdvisorName = 'MongoDB version check';

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest('Change advisors intervals before the upgrade @pre-upgrade', async ({ advisorsPage, page }) => {
    await page.goto(advisorsPage.configurationUrl, { timeout: Timeouts.ONE_MINUTE });
    await advisorsPage.builders.advisorsGroupHeader(groupName).click({ timeout: Timeouts.ONE_MINUTE });
    await advisorsPage.builders.advisorsChangeInterval(advisorName).click();
    await advisorsPage.builders.changeIntervalValue('Frequent').click();
    await advisorsPage.buttons.saveInterval.click();
    await advisorsPage.snackBar.verifySuccessMessage('Interval changed for Check for unsupported PostgreSQL');
    await expect(advisorsPage.builders.advisorIntervalValue(advisorName)).toHaveText('Frequent');
  });

  pmmTest('Disable advisor before upgrade @pre-upgrade', async ({ advisorsPage, page }) => {
    await page.goto(advisorsPage.configurationUrl, { timeout: Timeouts.ONE_MINUTE });
    await advisorsPage.builders.advisorsGroupHeader(groupName).click({ timeout: Timeouts.ONE_MINUTE });
    await advisorsPage.builders.disableAdvisor(disabledAdvisorName).click();
    await expect(advisorsPage.builders.disableAdvisor(disabledAdvisorName)).toHaveText('Enable');
  });

  pmmTest(
    'Verify disabled advisor remain disabled after upgrade @post-upgrade',
    async ({ advisorsPage, page }) => {
      await page.goto(advisorsPage.configurationUrl, { timeout: Timeouts.ONE_MINUTE });
      await advisorsPage.builders.advisorsGroupHeader(groupName).click({ timeout: Timeouts.ONE_MINUTE });
      await expect(advisorsPage.builders.disableAdvisor(disabledAdvisorName)).toHaveText('Enable');
    },
  );

  pmmTest('Change advisors intervals after the upgrade @post-upgrade', async ({ advisorsPage, page }) => {
    await page.goto(advisorsPage.configurationUrl, { timeout: Timeouts.ONE_MINUTE });
    await advisorsPage.builders.advisorsGroupHeader(groupName).click({ timeout: Timeouts.ONE_MINUTE });
    await expect(advisorsPage.builders.advisorIntervalValue(advisorName)).toHaveText('Frequent', {
      timeout: Timeouts.ONE_MINUTE,
    });
  });
});
