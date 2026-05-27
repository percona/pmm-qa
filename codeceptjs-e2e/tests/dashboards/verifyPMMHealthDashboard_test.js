Feature('Test PMM Health dashboard');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario('PMM-T1988 - Verify that all statuses on PMM Health dashboards are UP @nightly @nightly-generic @gssapi-nightly', async ({ I, dashboardPage }) => {
  I.amOnPage(dashboardPage.pmmHealth.url);
  await dashboardPage.pmmHealth.verifyStatuses();
});
