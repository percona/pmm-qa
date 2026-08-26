import pmmTest from '@fixtures/pmmTest';
import { expect, request as playwrightRequest } from '@playwright/test';
import BackupsApi from '@api/backups.api';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';
import { getFileLineCount } from '@helpers/archive.helper';
import { pmmUrl } from '../playwright.config';

pmmTest.describe.configure({ mode: 'default' });

const fileNameToCheck = 'pmm-managed.log';

pmmTest.beforeAll(async () => {
  const requestContext = await playwrightRequest.newContext({ baseURL: pmmUrl, ignoreHTTPSErrors: true });
  const backupsApi = new BackupsApi(requestContext);

  for (let i = 0; i < 10_000; i++) {
    await backupsApi.getLocationsList();
  }

  await requestContext.dispose();
});

pmmTest(
  'PMM-T1902 - Verify no line_count parameter when downloading logs @fb-settings',
  async ({ request }) => {
    const response = await request.get(apiEndpoints.server.logs, { headers: GrafanaHelper.getAuthHeader() });
    const actualLineCount = getFileLineCount(await response.body(), fileNameToCheck);

    expect(actualLineCount, `File ${fileNameToCheck} has ${actualLineCount} lines, but expected 50000`).toBe(
      50_000,
    );
  },
);

pmmTest(
  'PMM-T1903 - Verify line_count=10 parameter when downloading logs @fb-settings',
  async ({ request }) => {
    const response = await request.get(`${apiEndpoints.server.logs}?line-count=10`, {
      headers: GrafanaHelper.getAuthHeader(),
    });
    const actualLineCount = getFileLineCount(await response.body(), fileNameToCheck);

    expect(actualLineCount, `File ${fileNameToCheck} has ${actualLineCount} lines, but expected 10`).toBe(10);
  },
);

pmmTest(
  'PMM-T1904 - Verify line_count=-1 parameter when downloading logs @fb-settings',
  async ({ request }) => {
    const response = await request.get(`${apiEndpoints.server.logs}?line-count=-1`, {
      headers: GrafanaHelper.getAuthHeader(),
    });
    const actualLineCount = getFileLineCount(await response.body(), fileNameToCheck);

    expect(
      actualLineCount,
      `File ${fileNameToCheck} has ${actualLineCount} lines, but expected more than 50000`,
    ).toBeGreaterThan(50_000);
  },
);
