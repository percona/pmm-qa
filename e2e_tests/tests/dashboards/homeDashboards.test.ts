import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { GetService, ServiceType } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';

type OsDashboardKey = 'diskDetails' | 'memoryDetails' | 'nodesOverview';

interface PanelRow {
  dashboard: OsDashboardKey;
  dashboardName: string;
  dashboardType: 'multipleNodes' | 'singleNode';
  panelName: string;
  titleSuffix: string;
}

const panels: PanelRow[] = [
  {
    dashboard: 'diskDetails',
    dashboardName: 'Disk Details',
    dashboardType: 'singleNode',
    panelName: 'Disk Space Total',
    titleSuffix:
      '{"panelName":"Disk Space Total","dashboardType":"singleNode","dashboardName":"Disk Details","dashboard":"osDiskDetails"}',
  },
  {
    dashboard: 'diskDetails',
    dashboardName: 'Disk Details',
    dashboardType: 'singleNode',
    panelName: 'Disk Reads',
    titleSuffix:
      '{"panelName":"Disk Reads","dashboardType":"singleNode","dashboardName":"Disk Details","dashboard":"osDiskDetails"}',
  },
  {
    dashboard: 'diskDetails',
    dashboardName: 'Disk Details',
    dashboardType: 'singleNode',
    panelName: 'Disk Writes',
    titleSuffix:
      '{"panelName":"Disk Writes","dashboardType":"singleNode","dashboardName":"Disk Details","dashboard":"osDiskDetails"}',
  },
  {
    dashboard: 'memoryDetails',
    dashboardName: 'Memory Details',
    dashboardType: 'singleNode',
    panelName: 'Total RAM',
    titleSuffix:
      '{"panelName":"Total RAM","dashboardType":"singleNode","dashboardName":"Memory Details","dashboard":"osMemoryDetails"}',
  },
  {
    dashboard: 'nodesOverview',
    dashboardName: 'Nodes Overview',
    dashboardType: 'multipleNodes',
    panelName: 'Virtual Memory Total',
    titleSuffix:
      '{"panelName":"Virtual Memory Total","dashboardType":"multipleNodes","dashboardName":"Nodes Overview","dashboard":"osNodesOverview"}',
  },
  {
    dashboard: 'nodesOverview',
    dashboardName: 'Nodes Overview',
    dashboardType: 'multipleNodes',
    panelName: 'Monitored Nodes',
    titleSuffix:
      '{"panelName":"Monitored Nodes","dashboardType":"multipleNodes","dashboardName":"Nodes Overview","dashboard":"osNodesOverview"}',
  },
  {
    dashboard: 'nodesOverview',
    dashboardName: 'Nodes Overview',
    dashboardType: 'multipleNodes',
    panelName: 'Total Virtual CPUs',
    titleSuffix:
      '{"panelName":"Total Virtual CPUs","dashboardType":"multipleNodes","dashboardName":"Nodes Overview","dashboard":"osNodesOverview"}',
  },
];
const countServicesOfType = (services: GetService[], serviceType: ServiceType) =>
  services.filter((service) => service.service_type === serviceType).length;

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.describe(() => {
  pmmTest.describe.configure({ retries: 1 });

  for (const panel of panels) {
    pmmTest(
      `PMM-T1565 - Verify ability to access OS dashboards with correct filter setup from Home Dashboard @nightly  @dashboards | ${panel.titleSuffix}`,
      async ({ dashboard, page, urlHelper }) => {
        const osDashboard = dashboard.os[panel.dashboard];
        const panelDataLink = dashboard.builders
          .panelByExactName(panel.panelName)
          .getByTestId('data-testid Data link');

        await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, { from: 'now-12h', to: 'now' }));
        await dashboard.waitForDashboardToLoad();

        const nodeNames = (await dashboard.getVariableValues('Node Name')).filter((name) => name !== 'All');
        const currentPanelValue = await panelDataLink.innerText();

        await pmmTest.step('Select the first two node names and refresh the home dashboard', async () => {
          await dashboard.selectVariableValue('Node Name', nodeNames[0]);
          await dashboard.selectVariableValue('Node Name', nodeNames[1]);
          await dashboard.elements.refreshButton.click();
          await expect(panelDataLink.filter({ hasText: currentPanelValue })).toHaveCount(0, {
            timeout: Timeouts.THIRTY_SECONDS,
          });
        });

        const expectedNodeNames =
          panel.dashboardType === 'singleNode'
            ? [...nodeNames].sort()[0]
            : (await dashboard.builders.selectedVariableValues('Node Name').allTextContents()).join('');
        const nodeFilterMatches = (selectedValues: string[]) =>
          panel.dashboardType === 'singleNode'
            ? selectedValues.join('').includes(expectedNodeNames)
            : selectedValues.join('') === expectedNodeNames;
        const popupPromise = page.waitForEvent('popup');

        await dashboard.builders.panelHeaderByName(panel.panelName).getByRole('link').click();

        const popup = await popupPromise;

        await expect(popup).toHaveURL(new RegExp(osDashboard.url), { timeout: Timeouts.ONE_MINUTE });

        const osDashboardUrl = popup.url();

        await popup.close();
        await page.goto(osDashboardUrl);
        await expect(dashboard.builders.dashboardTitle(panel.dashboardName)).not.toHaveCount(0, {
          timeout: Timeouts.ONE_MINUTE,
        });
        await expect
          .poll(
            async () =>
              nodeFilterMatches(
                await dashboard.builders.selectedVariableValues('Node Name').allTextContents(),
              ),
            {
              message: `${panel.dashboardName} should keep the Node Name filter "${expectedNodeNames}" selected`,
              timeout: Timeouts.TWENTY_SECONDS,
            },
          )
          .toBe(true);
        await dashboard.verifyMetricsPresent(osDashboard.metrics);

        const noDataPanels = await dashboard.elements.noDataPanelName.allTextContents();
        const realFailures = noDataPanels.filter(
          (title) => !title.toLowerCase().includes('24') && !title.toLowerCase().includes('hour'),
        );
        const unacceptableNoDataPanels =
          noDataPanels.length > osDashboard.acceptableNoDataCount ? realFailures : [];

        expect(
          unacceptableNoDataPanels,
          `Expected ${osDashboard.acceptableNoDataCount} elements without data but found ${noDataPanels.length} on dashboard ${page.url()}. Report names are ${noDataPanels.join(', ')}`,
        ).toHaveLength(0);
      },
    );
  }
});

pmmTest(
  'PMM-T2007 - Verify Monitored DB Services panel on home dashboard @nightly  @dashboards @gssapi-nightly',
  async ({ api, dashboard, page }) => {
    const { services } = await api.inventoryApi.getServices();
    const mysql = countServicesOfType(services, ServiceType.mysql);
    const mongodb = countServicesOfType(services, ServiceType.mongodb);
    const pgsql = countServicesOfType(services, ServiceType.postgresql);
    const proxysql = countServicesOfType(services, ServiceType.proxysql);

    await page.goto(dashboard.home.url);
    await expect(dashboard.builders.panelByExactName('Monitored DB Services')).toContainText('MySQL', {
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect
      .poll(
        async () =>
          Number.parseInt((await dashboard.home.elements.monitoredServicesCounts.allTextContents())[0]),
        {
          message: 'Monitored DB Services panel should render the service counts',
          timeout: Timeouts.TEN_SECONDS,
        },
      )
      .not.toBeNaN();

    const [countOfMysql, countOfMongoDb, countOfPgSql, countOfProxySql] =
      await dashboard.home.elements.monitoredServicesCounts.allTextContents();

    expect(
      Number.parseInt(countOfMysql),
      `Expected Count of Mysql Services: "${mysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMysql}"`,
    ).toEqual(mysql);
    expect(
      Number.parseInt(countOfMongoDb),
      `Expected Count of MongoDb Services: "${mongodb}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfMongoDb}"`,
    ).toEqual(mongodb);
    expect(
      Number.parseInt(countOfPgSql),
      `Expected Count of PostgreSQL Services: "${pgsql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfPgSql}"`,
    ).toEqual(pgsql);
    expect(
      Number.parseInt(countOfProxySql),
      `Expected Count of ProxySQL Services: "${proxysql}" does not equal to count of services displayed on Monitored DB Services panel: "${countOfProxySql}"`,
    ).toEqual(proxysql);
  },
);
