import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const gcpDatabases = [
  {
    cluster: 'gc-pgsql17',
    database: process.env.GCP_PGSQL17_USER ?? '',
    environment: 'gc-pgsql17',
    host: process.env.GCP_PGSQL17_HOST ?? '',
    metric: 'pg_stat_database_xact_rollback',
    password: process.env.GCP_PGSQL17_PASSWORD ?? '',
    port: '5432',
    serviceName: 'gc-postgres17',
    type: 'postgresql',
    username: process.env.GCP_PGSQL17_USER ?? '',
  },
  {
    cluster: 'gc-mysql84',
    environment: 'gc-mysql84',
    host: process.env.GCP_MYSQL84_HOST ?? '',
    metric: 'mysql_global_status_max_used_connections',
    password: process.env.GCP_MYSQL84_PASSWORD ?? '',
    port: '3306',
    serviceName: 'gc-mysql84',
    type: 'mysql',
    username: process.env.GCP_MYSQL84_USER ?? '',
  },
] as const;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api }) => {
  await api.settingsApi.updateSettings({
    data_retention: '172800s',
    metrics_resolutions: { hr: '60s', lr: '300s', mr: '180s' },
  });
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ api }) => {
  await api.inventoryApi.removeNodesByName(gcpDatabases.map(({ serviceName }) => serviceName));
  await api.settingsApi.restoreSettingsDefaults();
});

for (const database of gcpDatabases) {
  pmmTest(
    `PMM-T2923 - Verify adding Remote Google Cloud Instance @not-ui-pipeline @gcp | ${database.serviceName}`,
    async ({ addInstancePage, page, servicesPage }) => {
      await page.goto(addInstancePage.url);
      await addInstancePage.fillRemoteDatabase(database.type, 'pmm-server', database);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    },
  );
}

for (const database of gcpDatabases) {
  pmmTest(
    `PMM-T2924 - Verify Remote Google Cloud Instance has Status Running @not-ui-pipeline @gcp | ${database.serviceName}`,
    async ({ agentsPage, api, page, servicesPage }) => {
      await api.remoteInstanceApi.ensureRemoteService(database);
      await page.goto(servicesPage.url);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });

      const { service_id } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
        `^${database.serviceName}$`,
        { service_type: ServiceType[database.type] },
      );

      await agentsPage.verifyRunningAgents(service_id, 2);
    },
  );
}

for (const database of gcpDatabases) {
  pmmTest(
    `PMM-T2925 - Verify dashboard after Remote Google Cloud Instances are added @not-ui-pipeline @gcp | ${database.serviceName}`,
    async ({ api, dashboard, urlHelper }) => {
      await api.remoteInstanceApi.ensureRemoteService(database);
      await dashboard.verifyNoDataPanelsAtMost(
        urlHelper.buildUrlWithParameters(
          {
            mysql: dashboard.mysql.mysqlInstanceOverview.url,
            postgresql: dashboard.postgresql.postgresqlInstancesOverview.url,
          }[database.type],
          { from: 'now-5m', serviceName: database.serviceName, to: 'now' },
        ),
        { mysql: 6, postgresql: 3 }[database.type],
        Timeouts.FIVE_MINUTES + Timeouts.ONE_MINUTE,
      );
    },
  );
}

for (const database of gcpDatabases) {
  pmmTest(
    `PMM-T2926 - Verify QAN after remote Google Cloud instance is added @not-ui-pipeline @gcp | ${database.serviceName}`,
    async ({ api, page, qanStoredMetrics, urlHelper }) => {
      await api.remoteInstanceApi.ensureRemoteService(database);
      await expect(async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            from: 'now-5m',
            serviceName: database.serviceName,
            to: 'now',
          }),
        );
        await qanStoredMetrics.waitForLoad();
        expect(
          await qanStoredMetrics.getQueryCount(),
          `The queries for service ${database.serviceName} instance do NOT exist`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    },
  );
}

for (const database of gcpDatabases) {
  pmmTest(
    `PMM-T2927 - Check metrics from Google Cloud exporters are hitting PMM Server @not-ui-pipeline @gcp | ${database.serviceName}`,
    async ({ api }) => {
      await api.remoteInstanceApi.ensureRemoteService(database);
      await api.grafanaApi.waitForMetric(
        `${database.metric}{service_name="${database.serviceName}"}`,
        Timeouts.TWO_MINUTES,
        'now-5m',
      );
    },
  );
}
