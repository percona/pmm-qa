import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const dataSourceName = `PMM-T2231 PostgreSQL ${Date.now()}`;
const connectDatabase = 'postgres';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2231 - Verify Grafana user is able to add and connect the datasource @pmm-ha',
  async ({ api, dataSourcesPage, haClusterHelper, page }) => {
    const podName = haClusterHelper.podNames()[0];
    const grafanaDatabase = haClusterHelper.grafanaDatabaseEnv(podName);

    await pmmTest.step(`Verify the Grafana database settings "${podName}" exports`, async () => {
      expect(grafanaDatabase.GF_DATABASE_TYPE, 'Grafana on HA must be backed by PostgreSQL').toEqual(
        'postgres',
      );
      expect(grafanaDatabase.GF_DATABASE_NAME).toEqual('grafana');
      expect(grafanaDatabase.GF_DATABASE_HOST, 'The host must carry the PostgreSQL port').toContain(':5432');
      expect(grafanaDatabase.GF_DATABASE_USER, 'The Grafana database user').toMatch(/.+/);
      expect(grafanaDatabase.GF_DATABASE_PASSWORD, 'The Grafana database password').toMatch(/.+/);
    });

    let uid = '';

    try {
      await pmmTest.step('Open the PostgreSQL data source form', async () => {
        await page.goto(dataSourcesPage.url);
        await dataSourcesPage.builders.pluginCard('PostgreSQL').click();

        await expect(dataSourcesPage.inputs.host).toBeVisible();

        // Picking the plugin already created the data source, so cleanup needs its
        // uid before the form is even filled.
        uid = /datasources\/edit\/([^/?]+)/.exec(page.url())?.[1] ?? '';

        expect(uid, `The new data source must carry a uid in "${page.url()}"`).toMatch(/.+/);
      });

      await pmmTest.step(
        `Fill "${dataSourceName}" with the credentials from "${podName}" and save`,
        async () => {
          await dataSourcesPage.inputs.name.fill(dataSourceName);
          await dataSourcesPage.inputs.host.fill(grafanaDatabase.GF_DATABASE_HOST);
          await dataSourcesPage.inputs.database.fill(connectDatabase);
          await dataSourcesPage.inputs.user.fill(grafanaDatabase.GF_DATABASE_USER);
          await dataSourcesPage.inputs.password.fill(grafanaDatabase.GF_DATABASE_PASSWORD);
          await dataSourcesPage.buttons.saveAndTest.click();
        },
      );

      await expect(
        dataSourcesPage.elements.testResult,
        `Connecting to "${grafanaDatabase.GF_DATABASE_HOST}" as "${grafanaDatabase.GF_DATABASE_USER}" must succeed`,
      ).toContainText('Database Connection OK', { timeout: Timeouts.ONE_MINUTE });
    } finally {
      if (uid) await api.grafanaApi.deleteDataSource(uid);
    }
  },
);
