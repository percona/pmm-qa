const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('Test Dashboards collection inside the Folders');

const panels = new DataTable(['panelName', 'dashboardType', 'dashboardName', 'dashboard']);

panels.add(['Disk Space Total', 'singleNode', 'Disk Details', 'osDiskDetails']);
panels.add(['Disk Reads', 'singleNode', 'Disk Details', 'osDiskDetails']);
panels.add(['Disk Writes', 'singleNode', 'Disk Details', 'osDiskDetails']);
panels.add(['Total RAM', 'singleNode', 'Memory Details', 'osMemoryDetails']);
panels.add(['Virtual Memory Total', 'multipleNodes', 'Nodes Overview', 'osNodesOverview']);
panels.add(['Monitored Nodes', 'multipleNodes', 'Nodes Overview', 'osNodesOverview']);
panels.add(['Total Virtual CPUs', 'multipleNodes', 'Nodes Overview', 'osNodesOverview']);

Before(async ({ I }) => {
  await I.Authorize();
});

Data(panels).Scenario(
  'PMM-T1565 - Verify ability to access OS dashboards with correct filter setup from Home Dashboard @nightly @dashboards',
  async ({
    I, current, dashboardPage, homePage,
  }) => {
    const {
      panelName, dashboardType, dashboardName, dashboard,
    } = current;

    await homePage.open();

    const expectedDashboard = dashboardPage[dashboard];

    I.click(dashboardPage.fields.openFiltersDropdownLocator('Node Name'));
    I.pressKey('Space');
    const nodeNames = await I.grabTextFromAll(dashboardPage.fields.allFilterDropdownOptions);
    const currentPanelValue = await I.grabTextFrom(dashboardPage.panelDataByTitle(panelName));

    I.click(dashboardPage.fields.filterDropdownOptionsLocator(nodeNames[0]));
    I.click(dashboardPage.fields.filterDropdownOptionsLocator(nodeNames[1]));
    I.pressKey('Escape');
    I.wait(2);
    I.click(dashboardPage.fields.refresh);
    I.waitForInvisible(locate(dashboardPage.panelDataByTitle(panelName)).withText(currentPanelValue), 20);
    I.wait(2);

    const expectedNodeName = dashboardType === 'singleNode'
      ? nodeNames.sort()[0]
      : await I.grabTextFrom(dashboardPage.fields.openFiltersDropdownLocator('Node Name'));

    I.click(dashboardPage.fields.clickablePanel(panelName));

    // Wait for tab to open
    I.wait(2);
    I.switchToNextTab();
    // need to skip PMM tour modal window due to new tab opening
    await dashboardPage.clickUpgradeModal();
    await dashboardPage.clickSkipPmmTour();

    I.waitForElement(dashboardPage.fields.dashboardTitle(dashboardName), 60);
    I.seeInCurrentUrl(expectedDashboard.clearUrl);

    if (dashboardType === 'singleNode') {
      await I.waitForText(expectedNodeName, 20, dashboardPage.fields.openFiltersDropdownLocator('Node Name'));
    } else {
      const values = await dashboardPage.getSelectedFilterValues('Node Name');

      assert.deepEqual(values.join(''), expectedNodeName);
    }

    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(expectedDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(expectedDashboard.noDataElements);
  },
).retry(1);

Scenario(
  'PMM-T2007 - Verify Monitored DB Services panel on home dashboard @nightly @dashboards @gssapi-nightly',
  async ({ I, inventoryAPI, dashboardPage }) => {
    const mysql = (await inventoryAPI.getServicesByType(SERVICE_TYPE.MYSQL)).data.mysql.length;
    const mongodb = (await inventoryAPI.getServicesByType(SERVICE_TYPE.MONGODB)).data.mongodb.length;
    const pgsql = (await inventoryAPI.getServicesByType(SERVICE_TYPE.POSTGRESQL)).data.postgresql.length;
    const proxysql = (await inventoryAPI.getServicesByType(SERVICE_TYPE.PROXYSQL)).data.proxysql.length;

    I.amOnPage(dashboardPage.homeDashboard.url);
    await dashboardPage.homeDashboard.verifyCountOfServices(mysql, mongodb, pgsql, proxysql);
  },
);
