const assert = require('assert');
const moment = require('moment');

Feature('Test PMM server with srv volume and password enw variable');

let testCaseName = '';
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

const runContainerWithPasswordVariableUpgrade = async (I) => {
  await I.verifyCommand('mkdir $HOME/srvPasswordUpgrade || true');
  await I.verifyCommand('chmod -R 777 $HOME/srvPasswordUpgrade/ || true');
  await I.verifyCommand(`docker run -v $HOME/srvPasswordUpgrade:/srv -d -e GF_SECURITY_ADMIN_PASSWORD=newpass -e PMM_ENABLE_INTERNAL_PG_QAN=1 --restart always --publish 8089:8080 --name pmm-server-password-upgrade ${dockerVersion}`);
  I.wait(30);
  await I.verifyCommand('docker exec pmm-server-password-upgrade yum update -y percona-release');
  await I.verifyCommand('docker exec pmm-server-password-upgrade sed -i\'\' -e \'s^/release/^/experimental/^\' /etc/yum.repos.d/pmm3-server.repo');
  await I.verifyCommand('docker exec pmm-server-password-upgrade percona-release enable percona experimental');
  await I.verifyCommand('docker exec pmm-server-password-upgrade yum clean all');
  await I.verifyCommand('docker restart pmm-server-password-upgrade');
};

const runContainerWithDataContainer = async (I) => {
  await I.verifyCommand(`docker run -e PMM_ENABLE_INTERNAL_PG_QAN=1 -v srvFolder:/srv -d --restart always --publish 8083:8080 --name pmm-server-empty-data-container ${dockerVersion}`);
};

const stopAndRemoveContainerWithDataContainer = async (I) => {
  await I.verifyCommand('docker stop pmm-server-empty-data-container || true');
  await I.verifyCommand('docker rm pmm-server-empty-data-container || true');
};

After(async ({ I }) => {
  if (testCaseName === 'PMM-T1244') {
    await stopAndRemoveContainerWithDataContainer(I);
    await I.verifyCommand('docker volume rm srvFolder || true');
  }
});

Scenario(
  'PMM-T1244 - Verify PMM Server with empty data container @docker-configuration',
  async ({
    I, adminPage, dashboardPage, queryAnalyticsPage,
  }) => {
    const basePmmUrl = 'http://127.0.0.1:8083/';

    await I.verifyCommand('docker volume create srvFolder');
    await runContainerWithDataContainer(I);
    await I.wait(120);
    await I.Authorize('admin', 'admin', basePmmUrl);
    testCaseName = 'PMM-T1244';
    await I.amOnPage(basePmmUrl + queryAnalyticsPage.url);
    I.dontSeeElement(queryAnalyticsPage.data.elements.noResultTableText);
    await I.waitForVisible(queryAnalyticsPage.data.elements.queryRows);
    const qanRows = await I.grabNumberOfVisibleElements(queryAnalyticsPage.data.elements.queryRows);

    assert.ok(qanRows > 0, 'Query Analytics are empty');
    await I.amOnPage(`${basePmmUrl + dashboardPage.nodeSummaryDashboard.url}?orgId=1&refresh=5s`);
    await dashboardPage.waitForAllGraphsToHaveData(300);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();

    await stopAndRemoveContainerWithDataContainer(I);
    await runContainerWithDataContainer(I);
    await I.wait(60);
    const logs = await I.verifyCommand('docker logs pmm-server-empty-data-container');

    assert.ok(!logs.includes('Error: The directory named as part of the path /srv/logs/supervisord.log does not exist'));
    await I.amOnPage(basePmmUrl + queryAnalyticsPage.url);
    adminPage.setAbsoluteTimeRange(moment().subtract({ hours: 12 }).format('YYYY-MM-DD HH:mm:00'), moment().subtract({ minutes: 1 }).format('YYYY-MM-DD HH:mm:00'));

    I.dontSeeElement(queryAnalyticsPage.data.elements.noResultTableText);
    await I.waitForVisible(queryAnalyticsPage.data.elements.queryRows);
    const qanRowsAfterRestart = await I.grabNumberOfVisibleElements(queryAnalyticsPage.data.elements.queryRows);

    assert.ok(qanRowsAfterRestart > 0, 'Query Analytics are empty after restart of docker container');

    await I.amOnPage(`${basePmmUrl + dashboardPage.nodeSummaryDashboard.url}?orgId=1&refresh=5s`);
    await dashboardPage.waitForAllGraphsToHaveData(180);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
    I.say(await I.verifyCommand('docker logs pmm-server-empty-data-container'));
  },
);

Scenario.skip(
  'PMM-T1256 Verify GF_SECURITY_ADMIN_PASSWORD environment variable after upgrade',
  async ({
    I, homePage,
  }) => {
    const basePmmUrl = 'http://127.0.0.1:8089/';

    await runContainerWithPasswordVariableUpgrade(I);
    await I.wait(30);
    testCaseName = 'PMM-T1256';
    await I.Authorize('admin', 'newpass', basePmmUrl);
    await I.amOnPage(basePmmUrl + homePage.url);
    await I.waitForElement(homePage.fields.dashboardHeaderLocator, 60);
    const { versionMinor } = await homePage.getVersions();

    await homePage.upgradePMM(versionMinor, 'pmm-server-password-upgrade');
    await I.unAuthorize();
    await I.wait(5);
    await I.Authorize('admin', 'newpass', basePmmUrl);
    await I.refreshPage();
    await I.waitForElement(homePage.fields.dashboardHeaderLocator, 60);
  },
);
