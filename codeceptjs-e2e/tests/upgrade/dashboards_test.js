const { isOvFAmiJenkinsJob } = require('../helper/constants');

Feature('PMM upgrade tests for dashboards');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-12587-2 Verify duplicate dashboards dont break after upgrade @post-dashboards-upgrade',
  async ({
    I, grafanaAPI, dashboardPage,
  }) => {
    const workFolder = await I.verifyCommand('pwd');
    const resp = JSON.parse(await I.readFileSync(`${workFolder}/dashboard.json`, false));

    const resp1 = await grafanaAPI.getDashboard(resp.DASHBOARD1_UID);
    const resp2 = await grafanaAPI.getDashboard(resp.DASHBOARD2_UID);

    // Trim leading '/' from response url
    const url1 = resp1.meta.url.replace(/^\/+/g, '');
    const url2 = resp2.meta.url.replace(/^\/+/g, '');

    I.amOnPage(url1);
    dashboardPage.waitForDashboardOpened();
    I.seeInCurrentUrl(url1);
    I.amOnPage(url2);
    dashboardPage.waitForDashboardOpened();
    I.seeInCurrentUrl(url2);
  },
);

// mongodb dashboards test after upgrade replicaset cluster routers.
// mysql overview and postgres overview.
// invetory nodes, services and agents.