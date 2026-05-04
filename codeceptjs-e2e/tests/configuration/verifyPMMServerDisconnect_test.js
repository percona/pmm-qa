Feature('Pmm Server stability');

// Address of PMM to be disconnected.
const pmmServerPort = '8180';
const basePmmUrl = `http://127.0.0.1:${pmmServerPort}/`;
let clientServerNetwork = 'pmm-ui-tests_server-network';
const serverImage = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

BeforeSuite(async ({ I }) => {
  await I.verifyCommand(`PMM_SERVER_IMAGE=${serverImage} docker compose -f docker-compose-disconnect.yml up -d`);
  clientServerNetwork = await I.verifyCommand('docker inspect pmm-client-disconnect -f \'{{range $k, $v := .NetworkSettings.Networks}}{{printf "%s\\n" $k}}{{end}}\' | grep -o \'.*server-network\'');
  I.wait(20);
  await I.verifyCommand('docker exec pmm-client-disconnect pmm-admin add mysql --username=root --password=7B*53@lCdflR --host=ps8 --port=3306 --query-source=perfschema ps8');
  // wait for the data to be scraped from db
  I.wait(60);
});

Before(async ({ I }) => {
  await I.Authorize('admin', 'admin', `http://127.0.0.1:${pmmServerPort}/`);
});

AfterSuite(async ({ I }) => {
  await I.verifyCommand('docker compose -f docker-compose-disconnect.yml down -v');
});

const withCustomBaseUrl = (url) => `${basePmmUrl}${url}`;

Scenario(
  'PMM-T1442 - Verify metrics are saved if PMM server was offline @disconnect',
  async ({ I, dashboardPage }) => {
    await I.amOnPage(withCustomBaseUrl(dashboardPage.mySQLInstanceOverview.url));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    I.dontSeeElement(dashboardPage.fields.metricPanelNa('Services panel'));
    await I.verifyCommand('docker stop pmm-server-disconnect');
    I.wait(400);
    await I.verifyCommand('docker start pmm-server-disconnect');
    // wait for the data to be scraped from db
    I.wait(60);
    await I.amOnPage(withCustomBaseUrl(`${dashboardPage.mySQLInstanceOverview.clearUrl}?orgId=1&from=now-3m&to=now-1m`));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
    I.dontSeeElement(dashboardPage.fields.metricPanelNa('Services panel'));
  },
);

Scenario(
  'PMM-T1443 - Verify metrics are saved if pmm-agent is stopped @disconnect',
  async ({ I, dashboardPage }) => {
    await I.amOnPage(withCustomBaseUrl(dashboardPage.mySQLInstanceOverview.url));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    I.dontSeeElement(dashboardPage.fields.metricPanelNa('Services panel'));
    await I.verifyCommand(`docker network disconnect ${clientServerNetwork} pmm-client-disconnect`);
    I.wait(400);
    await I.verifyCommand(`docker network connect ${clientServerNetwork} pmm-client-disconnect`);
    // wait for the data to be scraped from db
    I.wait(60);
    await I.amOnPage(withCustomBaseUrl(`${dashboardPage.mySQLInstanceOverview.clearUrl}?orgId=1&from=now-3m&to=now-1m`));
    await dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
    I.dontSeeElement(dashboardPage.fields.metricPanelNa('Services panel'));
  },
);
