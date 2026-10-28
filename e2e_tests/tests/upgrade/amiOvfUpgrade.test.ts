import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const newAdminPassword = 'pmm3admin!';

pmmTest.describe('PMM upgrade tests for AMI/OVF', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(({}, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) process.env.ADMIN_PASSWORD = newAdminPassword;
  });

  pmmTest(
    'PMM-T2410 - Change admin password before AMI/OVF upgrade @ami-ovf-pre-upgrade',
    async ({ changePasswordPage, page }) => {
      await page.goto(changePasswordPage.url);
      await changePasswordPage.fillChangePasswordForm(
        process.env.ADMIN_PASSWORD || 'admin',
        newAdminPassword,
      );
      await changePasswordPage.buttons.changePassword.click();
      await expect(changePasswordPage.messages.successPopUp).toContainText('User password changed', {
        timeout: Timeouts.THIRTY_SECONDS,
      });
    },
  );
});
