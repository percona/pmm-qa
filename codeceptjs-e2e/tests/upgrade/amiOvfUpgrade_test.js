Feature('Test specially for upgrading AMI/OVF');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario('PMM-T11111 - Change password before upgrade in AMI/OVF tests @ami-ovf-pre-upgrade', async ({ I, changePasswordPage }) => {
  I.amOnPage(changePasswordPage.url);
  changePasswordPage.fillChangePasswordForm(process.env.ADMIN_PASSWORD, 'pmm3admin!');
  changePasswordPage.applyChanges();
});
