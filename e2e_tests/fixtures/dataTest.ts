import { Page, TestInfo } from '@playwright/test';
import CliHelper from '../helpers/cli.helper';
import Credentials from '../helpers/credentials.helper';
import Dashboard from '../pages/dashboards/dashboards.page';
import GrafanaHelper from '../helpers/grafana.helper';
import Api from '../api/api';
import QueryAnalytics from '../pages/qan/queryAnalytics.page';
import UrlHelper from '../helpers/url.helper';
import pmmTest from './pmmTest';

type pmmTestDataType = {
  page: Page;
  cliHelper: CliHelper;
  credentials: Credentials;
  dashboard: Dashboard;
  grafanaHelper: GrafanaHelper;
  api: Api;
  queryAnalytics: QueryAnalytics;
  urlHelper: UrlHelper;
};

export default function data<T>(rows: T[]) {
  return {
    pmmTest(
      title: string,
      fn: (data: T, fixtures: pmmTestDataType, testInfo: TestInfo) => Promise<void> | void,
    ) {
      for (const row of rows) {
        pmmTest(
          `${title} | Data: ${JSON.stringify(row)}`,
          async (
            { cliHelper, credentials, dashboard, grafanaHelper, api, queryAnalytics, urlHelper, page },
            testInfo,
          ) => {
            await fn(
              row,
              { cliHelper, credentials, dashboard, grafanaHelper, api, queryAnalytics, urlHelper, page },
              testInfo,
            );
          },
        );
      }
    },
  };
}
