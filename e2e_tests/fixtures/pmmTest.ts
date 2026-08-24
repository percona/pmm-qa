import { test as base } from '@playwright/test';
import Dashboard from '@pages/dashboards/dashboards.page';
import UrlHelper from '@helpers/url.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import QanStoredMetrics from '@pages/qan/storedMetrics/storedMetrics.page';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import Api from '@api/api';
import HelpPage from '@pages/helpCenter.page';
import TourPage from '@pages/tour.page';
import Mocks from '@helpers/mocks.helper';
import LeftNavigation from '@pages/navigation.page';
import ServicesPage from '@pages/inventory/services.page';
import AgentsPage from '@pages/inventory/agents.page';
import PortalRemoval from '@pages/portalRemoval.page';
import QueryAnalytics from '@pages/qan/queryAnalytics.page';
import RealTimeAnalyticsPage from '@pages/qan/rta/realTimeAnalytics.page';
import NodesPage from '@pages/inventory/nodes.page';
import MongoDBHelper from '@helpers/mongodb.helper';
import K8sHelper from '@helpers/k8s.helper';
import HaClusterHelper from '@helpers/haCluster.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import SettingsPage from '@pages/ha/settings.page';
import HighAvailabilityPage from '@pages/ha/highAvailability.page';
import UpdatesPage from '@pages/updates.page';
import DownloadsPage from '@pages/downloads.page';
import ServerApi from '@api/server.api';
import { getServerVersion, serverVersionBelow } from '@helpers/version.helper';
import { minPmmVersion } from '@helpers/versionGates';
import AlertStatusPage from '@pages/alerts/alertStatus.page';
import AdvisorsPage from '@pages/advisors/advisors.page';
import TestState from '@helpers/upgradeState.helper';

const pmmTest = base.extend<{
  advisorsPage: AdvisorsPage;
  settingsPage: SettingsPage;
  alertStatusPage: AlertStatusPage;
  agentsPage: AgentsPage;
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
  haClusterHelper: HaClusterHelper;
  highAvailabilityPage: HighAvailabilityPage;
  k8sHelper: K8sHelper;
  mongoDbHelper: MongoDBHelper;
  api: Api;
  qanStoredMetrics: QanStoredMetrics;
  urlHelper: UrlHelper;
  helpPage: HelpPage;
  servicesPage: ServicesPage;
  tour: TourPage;
  mocks: Mocks;
  leftNavigation: LeftNavigation;
  portalRemoval: PortalRemoval;
  queryAnalytics: QueryAnalytics;
  nodesPage: NodesPage;
  realTimeAnalyticsPage: RealTimeAnalyticsPage;
  versionGate: undefined;
  updatesPage: UpdatesPage;
  downloadsPage: DownloadsPage;
  testState: TestState;
}>({
  advisorsPage: async ({ page }, use) => await use(new AdvisorsPage(page)),
  agentsPage: async ({ page }, use) => await use(new AgentsPage(page)),
  alertStatusPage: async ({ page }, use) => await use(new AlertStatusPage(page)),
  api: async ({ page, request }, use) => {
    const inventoryApi = new Api(page, request);

    await use(inventoryApi);
  },
  cliHelper: async ({}, use) => {
    const cliHelper = new CliHelper();

    await use(cliHelper);
  },
  context: async ({ context }, use) => {
    await context.route(apiEndpoints.users.me, (route) =>
      route.fulfill({
        body: JSON.stringify({
          alerting_tour_completed: true,
          product_tour_completed: true,
          snoozed_pmm_version: '',
          user_id: 1,
        }),
        contentType: 'application/json',
        status: 200,
      }),
    );
    await context.route(apiEndpoints.server.updates, (route) =>
      route.fulfill({
        body: JSON.stringify({
          installed: {},
          last_check: new Date().toISOString(),
          latest: {},
          update_available: false,
        }),
        contentType: 'application/json',
        status: 200,
      }),
    );
    await use(context);
  },
  credentials: async ({}, use) => {
    const credentials = new Credentials();

    await use(credentials);
  },
  dashboard: async ({ page }, use) => {
    const dashboardPage = new Dashboard(page);

    await use(dashboardPage);
  },
  downloadsPage: async ({ page }, use) => await use(new DownloadsPage(page)),
  grafanaHelper: async ({ page }, use) => {
    const grafanaHelper = new GrafanaHelper(page);

    await use(grafanaHelper);
  },
  haClusterHelper: async ({ k8sHelper }, use) => await use(new HaClusterHelper(k8sHelper)),
  helpPage: async ({ page }, use) => {
    const helpPage = new HelpPage(page);

    await use(helpPage);
  },
  highAvailabilityPage: async ({ page }, use) => await use(new HighAvailabilityPage(page)),
  k8sHelper: async ({}, use) => {
    const k8sHelper = new K8sHelper();

    await use(k8sHelper);
  },
  leftNavigation: async ({ page }, use) => await use(new LeftNavigation(page)),
  mocks: async ({ page }, use) => {
    const mocks = new Mocks(page);

    await use(mocks);
  },
  mongoDbHelper: async ({}, use) => {
    const mongoDbHelper = new MongoDBHelper({
      host: '127.0.0.1',
      password: 'pmmpass',
      port: 27_027,
      username: 'pmm',
    });

    await use(mongoDbHelper);
  },
  nodesPage: async ({ page }, use) => await use(new NodesPage(page)),
  portalRemoval: async ({ page }, use) => {
    const portalRemoval = new PortalRemoval(page);

    await use(portalRemoval);
  },
  qanStoredMetrics: async ({ page }, use) => {
    const qanStoredMetrics = new QanStoredMetrics(page);

    await use(qanStoredMetrics);
  },
  queryAnalytics: async ({ page }, use) => {
    const queryAnalytics = new QueryAnalytics(page);

    await use(queryAnalytics);
  },
  realTimeAnalyticsPage: async ({ page }, use) => await use(new RealTimeAnalyticsPage(page)),
  servicesPage: async ({ page }, use) => await use(new ServicesPage(page)),
  settingsPage: async ({ page }, use) => await use(new SettingsPage(page)),
  testState: async ({}, use) => await use(new TestState()),
  tour: async ({ page }, use) => {
    const tour = new TourPage(page);

    await use(tour);
  },
  updatesPage: async ({ page }, use) => await use(new UpdatesPage(page)),
  urlHelper: async ({}, use) => {
    const urlHelper = new UrlHelper();

    await use(urlHelper);
  },
  // Registering this as a beforeEach hook would only gate the first spec file that imports this
  // module, since the module is evaluated once and the hook attaches to the file loading at that
  // moment. An auto fixture applies to every test instead.
  versionGate: [
    async ({ request }, use, testInfo) => {
      const testId = testInfo.title.match(/PMM-T\d+/)?.[0];
      const minVersion = testId ? minPmmVersion[testId] : undefined;

      if (minVersion) {
        const version = await getServerVersion(new ServerApi(request));

        testInfo.skip(serverVersionBelow(version, minVersion), `Requires PMM Server ${minVersion}+`);
      }

      await use(undefined);
    },
    { auto: true },
  ],
});

export default pmmTest;
