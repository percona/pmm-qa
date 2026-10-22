import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const baseUrl = 'http://127.0.0.1:8082/';
const serviceName = 'pmm-server-postgresql';

pmmTest.describe('Test PMM server with external PostgreSQL', () => {
  pmmTest.describe.configure({ mode: 'default' });
  pmmTest.use({ baseURL: baseUrl });

  pmmTest.afterEach(async ({ externalPostgresHelper }) => {
    externalPostgresHelper.removeAll();
  });

  for (const postgresContainer of ['external-postgres', 'external-postgres-ssl']) {
    pmmTest(
      `PMM-T1678 - Verify PMM with external PostgreSQL @docker-configuration | ${postgresContainer}`,
      async ({ externalPostgresHelper, grafanaHelper, page, qanStoredMetrics, servicesPage, urlHelper }) => {
        const ssl = postgresContainer.endsWith('-ssl');

        await pmmTest.step('Start external PostgreSQL', async () => {
          await externalPostgresHelper.startPostgres(postgresContainer, ssl);
        });

        await pmmTest.step('Start PMM Server on the external PostgreSQL', async () => {
          await externalPostgresHelper.startPmmServer(postgresContainer, ssl);
        });

        await pmmTest.step('Verify the PostgreSQL service in Inventory', async () => {
          await grafanaHelper.authorize('admin', 'admin', baseUrl);
          await page.goto(servicesPage.url);
          await expect(servicesPage.builders.serviceNameCell(serviceName)).toBeVisible({
            timeout: Timeouts.THIRTY_SECONDS,
          });
          await expect(
            servicesPage.builders.addressByServiceName(serviceName),
            `'${serviceName}' is expected to have '${postgresContainer}' address`,
          ).toHaveText(postgresContainer);
          await servicesPage.verifyServiceMonitoringStatusOk(serviceName);
        });

        await pmmTest.step('Verify Query Analytics has data for the PostgreSQL service', async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
              from: 'now-5m',
              nodeName: 'pmm-server-db',
              refresh: '30s',
              serviceName,
              to: 'now',
            }),
          );
          await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.TEN_MINUTES);
        });
      },
    );
  }
});
