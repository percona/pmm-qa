import { test as base } from '@playwright/test';
import Dashboard from '@pages/dashboards/dashboards.page';
import UrlHelper from '@helpers/url.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import QanStoredMetrics from '@pages/qanStoredMetrics/qanStoredMetrics.page';
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
import QueryAnalytics from '@pages/rta/queryAnalytics.page';
import RtaOverview from '@pages/rta/rtaOverview.page';
import RtaSelection from '@pages/rta/rtaSelection.page';

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
  qanStoredMetrics: QanStoredMetrics;
  urlHelper: UrlHelper;
  helpPage: HelpPage;
  servicesPage: ServicesPage;
  themePage: ThemePage;
  tour: TourPage;
  welcomePage: WelcomePage;
  mocks: Mocks;
  portalRemoval: PortalRemoval;
  queryAnalytics: QueryAnalytics;
  rtaOverview: RtaOverview;
  rtaSelection: RtaSelection;
}>({
  agentsPage: async ({ page }, use) => await use(new AgentsPage(page)),
  api: async ({ page, request }, use) => await use(new Api(page, request)),
  cliHelper: async ({}, use) => await use(new CliHelper()),
  credentials: async ({}, use) => await use(new Credentials()),
  dashboard: async ({ page }, use) => await use(new Dashboard(page)),
  grafanaHelper: async ({ page }, use) => await use(new GrafanaHelper(page)),
  helpPage: async ({ page }, use) => await use(new HelpPage(page)),
  mocks: async ({ page }, use) => await use(new Mocks(page)),
  portalRemoval: async ({ page }, use) => await use(new PortalRemoval(page)),
  qanStoredMetrics: async ({ page }, use) => await use(new QanStoredMetrics(page)),
  queryAnalytics: async ({ page }, use) => await use(new QueryAnalytics(page)),
  rtaOverview: async ({ page }, use) => await use(new RtaOverview(page)),
  rtaSelection: async ({ page }, use) => await use(new RtaSelection(page)),
  servicesPage: async ({ page }, use) => await use(new ServicesPage(page)),
  themePage: async ({ page }, use) => await use(new ThemePage(page)),
  tour: async ({ page }, use) => await use(new TourPage(page)),
  urlHelper: async ({}, use) => await use(new UrlHelper()),
  welcomePage: async ({ page }, use) => await use(new WelcomePage(page)),
});

export default pmmTest;
