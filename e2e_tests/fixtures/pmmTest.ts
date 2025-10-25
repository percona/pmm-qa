import { test as base } from '@playwright/test';
import Dashboard from '../pages/dashboards.page';
import UrlHelper from '../helpers/url.helper';
import MysqlInstanceSummaryDashboard from '../pages/dashboards/mysql/mysqlInstanceSummary.dashboard';
import GrafanaHelper from '../helpers/grafana.helper';
import QueryAnalytics from '../pages/qan/queryAnalytics.page';
import InventoryApi from '../api/inventory.api';
import CliHelper from '../helpers/cli.helper';
import Credentials from '../helpers/credentials.helper';
import PostgresqlInstancesOverviewDashboard from '../pages/dashboards/pgsql/postgresqlInstancesOverview.dashboard';

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
  inventoryApi: InventoryApi;
  mysqlInstanceSummaryDashboard: MysqlInstanceSummaryDashboard;
  postgresqlInstancesOverviewDashboard: PostgresqlInstancesOverviewDashboard;
  queryAnalytics: QueryAnalytics;
  urlHelper: UrlHelper;
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

  inventoryApi: async ({ page, request }, use) => {
    const inventoryApi = new InventoryApi(page, request);
    await use(inventoryApi);
  },

  mysqlInstanceSummaryDashboard: async ({}, use) => {
    const mysqlInstanceSummaryDashboard = new MysqlInstanceSummaryDashboard();
    await use(mysqlInstanceSummaryDashboard);
  },

  postgresqlInstancesOverviewDashboard: async ({}, use) => {
    const postgresqlInstancesOverviewDashboard = new PostgresqlInstancesOverviewDashboard();
    await use(postgresqlInstancesOverviewDashboard);
  },

  queryAnalytics: async ({ page }, use) => {
    const queryAnalytics = new QueryAnalytics(page);
    await use(queryAnalytics);
  },

  urlHelper: async ({}, use) => {
    const urlHelper = new UrlHelper();
    await use(urlHelper);
  },
});

export default pmmTest;
