const assert = require('assert');
const moment = require('moment');

Feature('Test PMM server with srv volume and password enw variable');

let testCaseName = '';
const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

const runContainerWithoutDataContainer = async (I) => {
  await I.verifyCommand('mkdir $HOME/srvNoData/ || true');
  await I.verifyCommand('chmod -R 777 $HOME/srvNoData/ || true');
  await I.verifyCommand(`docker run -v $HOME/srvNoData:/srv -d -e PMM_ENABLE_INTERNAL_PG_QAN=1 --restart always --publish 8081:8080 --name pmm-server-srv ${dockerVersion}`);
};

const runContainerWithPasswordVariable = async (I) => {
  await I.verifyCommand('mkdir $HOME/srvPassword/ || true');
  await I.verifyCommand('chmod -R 777 $HOME/srvPassword/ || true');
  await I.verifyCommand(`docker run -v $HOME/srvPassword:/srv -d -e GF_SECURITY_ADMIN_PASSWORD=newpass -e PMM_ENABLE_INTERNAL_PG_QAN=1 --restart always --publish 8082:8080 --name pmm-server-password ${dockerVersion}`);
};

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

const stopAndRemoveContainerWithoutDataContainer = async (I) => {
  await I.verifyCommand('docker stop pmm-server-srv || true');
  await I.verifyCommand('docker rm pmm-server-srv || true');
  await I.verifyCommand('rm -fr $HOME/srvPasswordUpgrade || true');
};

const stopAndRemoveContainerWithPasswordVariable = async (I) => {
  await I.verifyCommand('docker stop pmm-server-password || true');
  await I.verifyCommand('docker rm pmm-server-password || true');
  await I.verifyCommand('rm -fr $HOME/srvPasswordUpgrade || true');
};

const stopAndRemoveContainerWithDataContainer = async (I) => {
  await I.verifyCommand('docker stop pmm-server-empty-data-container || true');
  await I.verifyCommand('docker rm pmm-server-empty-data-container || true');
};

After(async ({ I }) => {
  if (testCaseName === 'PMM-T1243') {
    await stopAndRemoveContainerWithoutDataContainer(I);
  } else if (testCaseName === 'PMM-T1244') {
    await stopAndRemoveContainerWithDataContainer(I);
    await I.verifyCommand('docker volume rm srvFolder || true');
  } else if (testCaseName === 'PMM-T1255') {
    await stopAndRemoveContainerWithPasswordVariable(I);
  }
});

Scenario(
  'PMM-T1243 - Verify PMM Server without data container @docker-configuration',
  async ({
    I, queryAnalyticsPage, dashboardPage,
  }) => {
    const basePmmUrl = 'http://127.0.0.1:8081/';

    await runContainerWithoutDataContainer(I);
    await I.wait(120);
    await I.Authorize('admin', 'admin', basePmmUrl);
    testCaseName = 'PMM-T1243';
    await I.amOnPage(basePmmUrl + queryAnalyticsPage.url);
    await I.waitForInvisible(queryAnalyticsPage.data.elements.noResultTableText, 180);
    await I.waitForVisible(queryAnalyticsPage.data.elements.queryRows);
    const qanRows = await I.grabNumberOfVisibleElements(queryAnalyticsPage.data.elements.queryRows);

    assert.ok(qanRows > 0, 'Query Analytics are empty');
    await I.amOnPage(`${basePmmUrl + dashboardPage.nodeSummaryDashboard.url}?orgId=1&refresh=5s`);
    await dashboardPage.waitForAllGraphsToHaveData(300);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();

    await stopAndRemoveContainerWithoutDataContainer(I);
    await runContainerWithoutDataContainer(I);
    await I.wait(60);
    const logs = await I.verifyCommand('docker logs pmm-server-srv');

    assert.ok(!logs.includes('Error: The directory named as part of the path /srv/logs/supervisord.log does not exist'));
    const url = I.buildUrlWithParams(
      basePmmUrl + queryAnalyticsPage.url,
      { from: 'now-30m' },
    );

    await I.amOnPage(url);

    await I.waitForInvisible(queryAnalyticsPage.data.elements.noResultTableText, 240);
    await I.waitForVisible(queryAnalyticsPage.data.elements.queryRows);
    const qanRowsAfterRestart = await I.grabNumberOfVisibleElements(queryAnalyticsPage.data.elements.queryRows);

    assert.ok(qanRowsAfterRestart > 0, 'Query Analytics are empty after restart of docker container');

    await I.amOnPage(`${basePmmUrl + dashboardPage.nodeSummaryDashboard.url}?orgId=1&refresh=5s`);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();
  },
);

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

Scenario(
  'PMM-T1255 + PMM-T1279 - Verify GF_SECURITY_ADMIN_PASSWORD environment variable also with changed admin password @docker-configuration',
  async ({
    I, homePage, loginPage,
  }) => {
    const basePmmUrl = 'http://127.0.0.1:8082/';

    await runContainerWithPasswordVariable(I);
    await I.wait(30);
    testCaseName = 'PMM-T1255';
    const logs = await I.verifyCommand('docker logs pmm-server-password');

    assert.ok(!logs.includes('Configuration warning: unknown environment variable "GF_SECURITY_ADMIN_PASSWORD=newpass".'));

    await I.Authorize('admin', 'admin', basePmmUrl);
    await I.amOnPage(basePmmUrl + homePage.url);
    await I.waitForVisible('//h1[text()="Percona Monitoring and Management"]');
    await I.unAuthorize();
    await I.refreshPage();
    await I.waitInUrl(loginPage.url);
    await I.Authorize('admin', 'newpass', basePmmUrl);
    await I.wait(1);
    await I.refreshPage();
    await I.waitForElement(homePage.fields.dashboardHeaderLocator, 60);
    await I.verifyCommand('docker exec -t pmm-server-password change-admin-password anotherpass');
    await I.unAuthorize();
    await I.waitInUrl(loginPage.url);
    await I.Authorize('admin', 'anotherpass', basePmmUrl);
    await I.wait(5);
    await I.refreshPage();
    await I.waitForElement(homePage.fields.dashboardHeaderLocator, 60);
  },
);

Scenario(
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
