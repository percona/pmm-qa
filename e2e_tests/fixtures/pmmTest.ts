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
import VacuumDashboard from '@pages/dashboards/postgresql/vacuumDashboard';
import apiEndpoints from '@helpers/apiEndpoints';
import SettingsPage from '@pages/ha/settings.page';

const pmmTest = base.extend<{
  settingsPage: SettingsPage;
  agentsPage: AgentsPage;
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
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
  vacuumDashboardPage: VacuumDashboard;
}>({
  agentsPage: async ({ page }, use) => await use(new AgentsPage(page)),
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
  grafanaHelper: async ({ page }, use) => {
    const grafanaHelper = new GrafanaHelper(page);

    await use(grafanaHelper);
  },
  helpPage: async ({ page }, use) => {
    const helpPage = new HelpPage(page);

    await use(helpPage);
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
  tour: async ({ page }, use) => {
    const tour = new TourPage(page);

    await use(tour);
  },
  urlHelper: async ({}, use) => {
    const urlHelper = new UrlHelper();

    await use(urlHelper);
  },
  vacuumDashboardPage: async ({ page }, use) => await use(new VacuumDashboard(page)),
});

export default pmmTest;
