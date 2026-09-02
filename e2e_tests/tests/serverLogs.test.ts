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
    await backupsApi.getLocations();
  }

  await requestContext.dispose();
});

const scenarios = [
  {
    assertLineCount: (lineCount: number, message: string) => expect(lineCount, message).toBe(50_000),
    expectation: '50000',
    query: '',
    title: 'PMM-T1902 - Verify no line_count parameter when downloading logs @fb-settings',
  },
  {
    assertLineCount: (lineCount: number, message: string) => expect(lineCount, message).toBe(10),
    expectation: '10',
    query: '?line-count=10',
    title: 'PMM-T1903 - Verify line_count=10 parameter when downloading logs @fb-settings',
  },
  {
    assertLineCount: (lineCount: number, message: string) =>
      expect(lineCount, message).toBeGreaterThan(50_000),
    expectation: 'more than 50000',
    query: '?line-count=-1',
    title: 'PMM-T1904 - Verify line_count=-1 parameter when downloading logs @fb-settings',
  },
];

for (const { assertLineCount, expectation, query, title } of scenarios) {
  pmmTest(title, async ({ request }) => {
    const response = await request.get(`${apiEndpoints.server.logs}${query}`, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), response.statusText()).toEqual(200);

    const actualLineCount = getFileLineCount(await response.body(), fileNameToCheck);

    assertLineCount(
      actualLineCount,
      `File ${fileNameToCheck} has ${actualLineCount} lines, but expected ${expectation}`,
    );
  });
}
