import { test as base } from '@playwright/test';
import Dashboard from '@pages/dashboards/dashboards.page';
import UrlHelper from '@helpers/url.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import QueryAnalytics from '@pages/qan/queryAnalytics.page';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import Api from '@api/api';
import ThemePage from '@pages/theme.page';
import TourPage from '@pages/tour.page';

base.beforeEach(async ({ page }) => {
  // Mock user details call to prevent the tours from showing
  await page.route('**/v1/users/me', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        user_id: 1,
        product_tour_completed: true,
        alerting_tour_completed: true,
        snoozed_pmm_version: '',
      }),
    }),
  );

  // Mock upgrade call to prevent upgrade modal from showing.
  await page.route('**/v1/server/updates?force=**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
    }),
  );
});

const pmmTest = base.extend<{
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
  api: Api;
  queryAnalytics: QueryAnalytics;
  urlHelper: UrlHelper;
  themePage: ThemePage;
  tour: TourPage;
}>({
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

  api: async ({ page, request }, use) => {
    const inventoryApi = new Api(page, request);
    await use(inventoryApi);
  },

  queryAnalytics: async ({ page }, use) => {
    const queryAnalytics = new QueryAnalytics(page);
    await use(queryAnalytics);
  },

  urlHelper: async ({}, use) => {
    const urlHelper = new UrlHelper();
    await use(urlHelper);
  },

  themePage: async ({ page }, use) => {
    const themePage = new ThemePage(page);
    await use(themePage);
  tour: async ({ page }, use) => {
    const tour = new TourPage(page);
    await use(tour);
  },
});

export default pmmTest;
