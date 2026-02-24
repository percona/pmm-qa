import { test as base } from '@playwright/test';
import Dashboard from '@pages/dashboards/dashboards.page';
import UrlHelper from '@helpers/url.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import QueryAnalytics from '@pages/qan/queryAnalytics.page';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import Api from '@api/api';
import HelpPage from '@pages/helpCenter.page';
import ThemePage from '@pages/theme.page';
import TourPage from '@pages/tour.page';
import WelcomePage from '@pages/welcome.page';
import Mocks from '@helpers/mocks.helper';
import ServicesPage from '@pages/inventory/services.page';
import AgentsPage from '@pages/inventory/agents.page';
import PortalRemoval from '@pages/portalRemoval.page';
import RealTimeAnalyticsPage from '@pages/rta/realTimeAnalytics.page';
import NodesPage from '@pages/inventory/nodes.page';

base.beforeEach(async ({ page }) => {
  // Mock user details call to prevent the tours from showing
  await page.route('**/v1/users/me', (route) =>
    route.fulfill({
      body: JSON.stringify({
        alerting_tour_completed: true,
        product_tour_completed: true,
        snoozed_pmm_version: '',
        user_id: 1,
      }),
      status: 200,
    }),
  );
  // Mock upgrade call to prevent upgrade modal from showing.
  await page.route('**/v1/server/updates?force=**', (route) =>
    route.fulfill({
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
      status: 200,
    }),
  );
});

const pmmTest = base.extend<{
  agentsPage: AgentsPage;
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
  api: Api;
  queryAnalytics: QueryAnalytics;
  urlHelper: UrlHelper;
  helpPage: HelpPage;
  servicesPage: ServicesPage;
  themePage: ThemePage;
  tour: TourPage;
  welcomePage: WelcomePage;
  mocks: Mocks;
  portalRemoval: PortalRemoval;
  nodesPage: NodesPage;
  realTimeAnalyticsPage: RealTimeAnalyticsPage;
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
  mocks: async ({ page }, use) => {
    const mocks = new Mocks(page);

    await use(mocks);
  },
  nodesPage: async ({ page }, use) => await use(new NodesPage(page)),
  portalRemoval: async ({ page }, use) => {
    const portalRemoval = new PortalRemoval(page);

    await use(portalRemoval);
  },
  queryAnalytics: async ({ page }, use) => {
    const queryAnalytics = new QueryAnalytics(page);

    await use(queryAnalytics);
  },
  realTimeAnalyticsPage: async ({ page }, use) => await use(new RealTimeAnalyticsPage(page)),
  servicesPage: async ({ page }, use) => await use(new ServicesPage(page)),
  themePage: async ({ page }, use) => {
    const themePage = new ThemePage(page);

    await use(themePage);
  },
  tour: async ({ page }, use) => {
    const tour = new TourPage(page);

    await use(tour);
  },
  urlHelper: async ({}, use) => {
    const urlHelper = new UrlHelper();

    await use(urlHelper);
  },
  welcomePage: async ({ page }, use) => {
    const welcomePage = new WelcomePage(page);

    await use(welcomePage);
  },
});

export default pmmTest;
