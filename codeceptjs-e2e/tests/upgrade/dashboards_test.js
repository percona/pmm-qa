const { isOvFAmiJenkinsJob } = require('../helper/constants');

Feature('PMM upgrade tests for dashboards');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T391 + PMM-T1818 - Verify user is able to create and set custom home dashboard @pre-dashboards-upgrade',
  async ({
    I, grafanaAPI, dashboardPage, searchDashboardsModal,
  }) => {
    const insightFolder = await grafanaAPI.lookupFolderByName(searchDashboardsModal.folders.insight.name);

    await grafanaAPI.createCustomDashboard(grafanaAPI.randomDashboardName, insightFolder.id, null, ['pmm-qa', grafanaAPI.randomTag]);
    const folder = await grafanaAPI.createFolder(grafanaAPI.customFolderName);
    let additionalPanel = null;
    const additionalPanelName = 'Custom Panel';

    const libResp = await grafanaAPI.savePanelToLibrary(additionalPanelName, folder.id);
    const libPanel = libResp.result.model;

    libPanel.libraryPanel.meta = libResp.result.meta;
    libPanel.libraryPanel.version = 1;
    libPanel.libraryPanel.uid = libResp.result.uid;
    additionalPanel = [libPanel];

    const resp = await grafanaAPI.createCustomDashboard(grafanaAPI.customDashboardName, folder.id, additionalPanel, []);

    await grafanaAPI.starDashboard(resp.id);
    await grafanaAPI.setHomeDashboard(resp.id);

    I.amOnPage('pmm-ui/graph/');
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyMetricsExistence([additionalPanelName]);
    I.seeInCurrentUrl(grafanaAPI.customDashboardName);
  },
);

Scenario(
  'PMM-12587-1 Verify duplicate dashboards dont break after upgrade @pre-dashboards-upgrade',
  async ({
    I, grafanaAPI, searchDashboardsModal,
  }) => {
    const insightFolder = await grafanaAPI.lookupFolderByName(searchDashboardsModal.folders.insight.name);
    const experimentalFolder = await grafanaAPI.lookupFolderByName(searchDashboardsModal.folders.experimental.name);

    const resp1 = await grafanaAPI.createCustomDashboard('test-dashboard', insightFolder.id);
    const resp2 = await grafanaAPI.createCustomDashboard('test-dashboard', experimentalFolder.id);

    await I.writeFileSync('./dashboard.json', JSON.stringify({
      DASHBOARD1_UID: resp1.uid,
      DASHBOARD2_UID: resp2.uid,
    }), false);

    // Check if file with Dashboard info is present.
    I.assertNotEqual(I.fileSize('./dashboard.json', false), 0, 'Was expecting Dashboard info in the File, but its empty');
  },
);

Scenario(
  'PMM-T391 + PMM-T1818 - Verify that custom home dashboard stays as home dashboard after upgrade @post-dashboards-upgrade',
  async ({ I, grafanaAPI, dashboardPage }) => {
    I.amOnPage('/pmm-ui/');
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyMetricsExistence([grafanaAPI.customPanelName]);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(1);
    I.seeInCurrentUrl(grafanaAPI.customDashboardName);

    await I.say('Verify there is no "Error while loading library panels" errors on dashboard and no errors in grafana.log');
    I.wait(1);
    let errorLogs;

    if (!isOvFAmiJenkinsJob) {
      errorLogs = await I.verifyCommand('docker exec pmm-server cat /srv/logs/grafana.log | grep level=error');

      const loadingLibraryErrorLine = errorLogs.split('\n')
        .filter((line) => line.includes('Error while loading library panels'));

      I.assertEmpty(
        loadingLibraryErrorLine,
        `Logs contains errors about while loading library panels! \n The line is: \n ${loadingLibraryErrorLine}`,
      );
    }
  },
);

Scenario(
  'PMM-T998 - Verify dashboard folders after upgrade @post-dashboards-upgrade',
  async ({
    I, searchDashboardsModal, grafanaAPI, homePage, dashboardPage,
  }) => {
    await homePage.open();
    I.waitForVisible(locate('a').withText('Dashboards'));
    I.click(locate('a').withText('Dashboards'));

    const actualFolders = (await searchDashboardsModal.getFoldersList());

    I.assertDeepIncludeMembers(actualFolders, [grafanaAPI.customFolderName]);
    I.click(searchDashboardsModal.fields.folderItemLocatorExpand(grafanaAPI.customFolderName));
    I.waitForVisible(searchDashboardsModal.fields.folderItemLocator(grafanaAPI.customDashboardName));
  },
);

Scenario(
  'PMM-T1091 - Verify PMM Dashboards folders are correct @post-dashboards-upgrade',
  async ({
    I, searchDashboardsModal,
  }) => {
    I.amOnPage(searchDashboardsModal.url);

    searchDashboardsModal.waitForOpened();
    const foldersNames = Object.values(searchDashboardsModal.folders).map((folder) => folder.name);

    foldersNames.push('auto-test-folder');
    const actualFolders = (await searchDashboardsModal.getFoldersList());

    I.assertDeepMembers([...actualFolders].sort(), [...foldersNames].sort());
  },
);

Scenario(
  'PMM-T1003 - Verify UI upgrade with Custom dashboard @post-dashboards-upgrade',
  async ({
    I, searchDashboardsModal, grafanaAPI, homePage, dashboardPage,
  }) => {
    await homePage.open();
    I.waitForVisible(locate('a').withText('Dashboards'), 10);
    I.click(locate('a').withText('Dashboards'));

    searchDashboardsModal.expandFolder(searchDashboardsModal.folders.insight.name);
    I.seeElement(searchDashboardsModal.fields.folderItemLocator(grafanaAPI.randomDashboardName));
    I.seeElement(searchDashboardsModal.fields.folderItemWithTagLocator(grafanaAPI.randomDashboardName, grafanaAPI.randomTag));
  },
);

Scenario(
  'PMM-T424 Verify PT Summary Panel is available after Upgrade @post-dashboards-upgrade',
  async ({ I, dashboardPage }) => {
    const filter = 'Node Name';

    I.amOnPage(`${dashboardPage.nodeSummaryDashboard.url}&var-node_name=pmm-server`);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.applyFilter(filter, 'pmm-server');

    I.waitForElement(dashboardPage.nodeSummaryDashboard.ptSummaryDetail.reportContainer, 60);
    I.seeElement(dashboardPage.nodeSummaryDashboard.ptSummaryDetail.reportContainer);
  },
);

Scenario(
  'PMM-12587-2 Verify duplicate dashboards dont break after upgrade @post-dashboards-upgrade',
  async ({
    I, grafanaAPI, dashboardPage,
  }) => {
    console.log(`Current folder is: ${await I.verifyCommand(`pwd`)}`)
    const resp = JSON.parse(await I.readFileSync('/home/ec2-user/workspace/pmm3-upgrade-test-runner/dashboard.json', false));

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
