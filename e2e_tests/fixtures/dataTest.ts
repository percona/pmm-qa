import { Page, TestInfo } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import Credentials from '@helpers/credentials.helper';
import Dashboard from '@pages/dashboards/dashboards.page';
import GrafanaHelper from '@helpers/grafana.helper';
import Api from '@api/api';
import UrlHelper from '@helpers/url.helper';
import pmmTest from './pmmTest';
import AgentsPage from '@pages/inventory/agents.page';
import HelpPage from '@pages/helpCenter.page';
import ServicesPage from '@pages/inventory/services.page';
import ThemePage from '@pages/theme.page';
import TourPage from '@pages/tour.page';
import WelcomePage from '@pages/welcome.page';
import Mocks from '@helpers/mocks.helper';
import PortalRemoval from '@pages/portalRemoval.page';
import NodesPage from '@pages/inventory/nodes.page';
import QueryAnalyticsPage from '@pages/qan/queryAnalytics.page';

interface pmmTestDataType {
  page: Page;
  agentsPage: AgentsPage;
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
  api: Api;
  queryAnalytics: QueryAnalyticsPage;
  urlHelper: UrlHelper;
  helpPage: HelpPage;
  servicesPage: ServicesPage;
  themePage: ThemePage;
  tour: TourPage;
  welcomePage: WelcomePage;
  mocks: Mocks;
  portalRemoval: PortalRemoval;
  nodesPage: NodesPage;
}

const data = <T>(rows: T[]) => ({
  pmmTest: (
    title: string,
    fn: (data: T, fixtures: pmmTestDataType, testInfo: TestInfo) => Promise<void> | void,
  ) => {
    for (const row of rows) {
      pmmTest(
        `${title} | Data: ${JSON.stringify(row)}`,
        async (
          {
            agentsPage,
            api,
            cliHelper,
            credentials,
            dashboard,
            grafanaHelper,
            helpPage,
            mocks,
            nodesPage,
            page,
            portalRemoval,
            queryAnalytics,
            servicesPage,
            themePage,
            tour,
            urlHelper,
            welcomePage,
          },
          testInfo,
        ) => {
          await fn(
            row,
            {
              agentsPage,
              api,
              cliHelper,
              credentials,
              dashboard,
              grafanaHelper,
              helpPage,
              mocks,
              nodesPage,
              page,
              portalRemoval,
              queryAnalytics,
              servicesPage,
              themePage,
              tour,
              urlHelper,
              welcomePage,
            },
            testInfo,
          );
        },
      );
    }
  },
});

export default data;
