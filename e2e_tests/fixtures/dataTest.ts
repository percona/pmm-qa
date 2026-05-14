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
import Mocks from '@helpers/mocks.helper';
import PortalRemoval from '@pages/portalRemoval.page';
import NodesPage from '@pages/inventory/nodes.page';
import AdvancedSettingsPage from '@pages/ha/advancedSettings.page';
import MongoDBHelper from '@helpers/mongodb.helper';
import QanStoredMetrics from '@pages/qan/storedMetrics/storedMetrics.page';
import LeftNavigation from '@pages/navigation.page';
import QueryAnalytics from '@pages/qan/queryAnalytics.page';
import RealTimeAnalyticsPage from '@pages/qan/rta/realTimeAnalytics.page';
import VacuumDashboard from '@pages/dashboards/postgresql/vacuumDashboard';

interface pmmTestDataType {
  advancedSettingsPage: AdvancedSettingsPage;
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
  themePage: ThemePage;
  tour: TourPage;
  mocks: Mocks;
  leftNavigation: LeftNavigation;
  portalRemoval: PortalRemoval;
  queryAnalytics: QueryAnalytics;
  nodesPage: NodesPage;
  realTimeAnalyticsPage: RealTimeAnalyticsPage;
  vacuumDashboardPage: VacuumDashboard;
  page: Page;
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
            advancedSettingsPage,
            agentsPage,
            api,
            cliHelper,
            credentials,
            dashboard,
            grafanaHelper,
            helpPage,
            leftNavigation,
            mocks,
            mongoDbHelper,
            nodesPage,
            page,
            portalRemoval,
            qanStoredMetrics,
            queryAnalytics,
            realTimeAnalyticsPage,
            servicesPage,
            themePage,
            tour,
            urlHelper,
            vacuumDashboardPage,
          },
          testInfo,
        ) => {
          await fn(
            row,
            {
              advancedSettingsPage,
              agentsPage,
              api,
              cliHelper,
              credentials,
              dashboard,
              grafanaHelper,
              helpPage,
              leftNavigation,
              mocks,
              mongoDbHelper,
              nodesPage,
              page,
              portalRemoval,
              qanStoredMetrics,
              queryAnalytics,
              realTimeAnalyticsPage,
              servicesPage,
              themePage,
              tour,
              urlHelper,
              vacuumDashboardPage,
            },
            testInfo,
          );
        },
      );
    }
  },
});

export default data;
