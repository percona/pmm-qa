import pmmTest from '@fixtures/pmmTest';
import { Client } from 'pg';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

let client: Client;

pmmTest.beforeAll(async ({ credentials }) => {
  client = new Client(credentials.pgsql.client);

  await client.connect();
});

pmmTest.afterAll(async () => {
  await client.end();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2204 - Verify explain tab in QAN does not load forever if there is no example @qan',
  async ({ api, page, qanStoredMetrics, urlHelper }) => {
    await client.query('SELECT pg_sleep(1)');

    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('pgsql_pgss');

    await page.goto(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
        from: 'now-5m',
        qanQuerySearch: 'SELECT pg_sleep',
        refresh: '5s',
        serviceName: service_name,
      }),
    );

    await qanStoredMetrics.waitForQanStoredMetricsToHaveData(Timeouts.TWO_MINUTES);
    await qanStoredMetrics.elements.firstRow.click();
    await qanStoredMetrics.qanDetails.buttons.explainTab.click();
    await expect(qanStoredMetrics.qanDetails.elements.explainNoData).toHaveText(
      qanStoredMetrics.qanDetails.messages.explainNoData,
    );
    await qanStoredMetrics.elements.spinner
      .first()
      .waitFor({ state: 'detached', timeout: Timeouts.FIVE_SECONDS });
  },
);
