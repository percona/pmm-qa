import { test as base } from '@playwright/test';
import Dashboard from '@pages/dashboards/dashboards.page';
import { authorize, suppressTour, suppressUpgradeNotification } from '@helpers/grafana.helper';
import QueryAnalytics from '@pages/qan/queryAnalytics.page';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import Api from '@api/api';

const pmmTest = base.extend<{
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  api: Api;
  queryAnalytics: QueryAnalytics;
  loginUI: void;
}>({
  cliHelper: async ({}, use) => {
    const cliHelper = new CliHelper();
    await use(cliHelper);
  },

  credentials: async ({}, use) => {
    const credentials = new Credentials();
    await use(credentials);
  },

  dashboard: async ({ page, loginUI }, use) => {
    const dashboardPage = new Dashboard(page);
    await use(dashboardPage);
  },

  loginUI: async ({ page }, use) => {
    await suppressTour(page);
    await suppressUpgradeNotification(page);
    await authorize(page);
    await use();
  },

  api: async ({ page, request }, use) => {
    const inventoryApi = new Api(page, request);
    await authorize(page);
    await use(inventoryApi);
  },

  queryAnalytics: async ({ page, loginUI }, use) => {
    const queryAnalytics = new QueryAnalytics(page);
    await use(queryAnalytics);
  },
});

export default pmmTest;
