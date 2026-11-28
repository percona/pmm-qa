import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const baseUrl = 'http://127.0.0.1:8081/';
const compose = 'docker compose -f docker-compose-clickhouse.yml';
const pmmServerContainer = 'pmm-server-ext-clickhouse-qan';

pmmTest.describe('External ClickHouse', () => {
  pmmTest.describe.configure({ mode: 'default' });
  pmmTest.use({ baseURL: baseUrl });

  pmmTest.beforeAll(async ({ cliHelper, credentials }) => {
    const { password, username } = credentials.perconaServer;

    cliHelper.execute(`${compose} up -d --wait`).assertSuccess();

    await expect(async () => {
      cliHelper
        .execute(
          `docker exec pmm-client-clickhouse pmm-admin add mysql --username=${username} --password=${password} --query-source=perfschema ps8 ps8:3306`,
        )
        .assertSuccess();
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
  });

  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize('admin', 'admin', baseUrl);
  });

  pmmTest.afterAll(async ({ cliHelper }) => {
    cliHelper.execute(`${compose} down -v`).assertSuccess();
  });

  pmmTest(
    'PMM-T1218 - Verify PMM with external Clickhouse @docker-configuration',
    async ({ dataSourcesPage, page, qanStoredMetrics, urlHelper }) => {
      const qanUrl = urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' });

      await pmmTest.step('Verify the ClickHouse data source points at the external ClickHouse', async () => {
        await page.goto(dataSourcesPage.listUrl);
        await dataSourcesPage.elements.clickHouseDataSource.click({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(dataSourcesPage.inputs.clickHouseServerAddress).toHaveValue('external-clickhouse');
        await expect(dataSourcesPage.inputs.clickHouseServerPort).toHaveValue('9000');
      });

      await pmmTest.step('Verify Query Analytics has data', async () => {
        await page.goto(qanUrl);
        await qanStoredMetrics.waitUntilQanStoredMetricsLoaded(Timeouts.FIVE_MINUTES);
      });

      await pmmTest.step('Verify Query Analytics has data for the ps8 MySQL service', async () => {
        await expect(async () => {
          await qanStoredMetrics.openFilteredByService(qanUrl, 'ps8');
          await expect(qanStoredMetrics.elements.queryRows.visible()).not.toHaveCount(0);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    },
  );

  pmmTest(
    'PMM-T2020 - Verify external clickhouse as datasource on explore page @docker-configuration',
    async ({ dataSourcesPage, page }) => {
      const query = 'SELECT * FROM pmm.metrics LIMIT 10;';

      await pmmTest.step('Open the ClickHouse SQL editor in Explore', async () => {
        await page.goto(dataSourcesPage.exploreUrl);
        await dataSourcesPage.selectExploreDataSource('ClickHouse');
        await dataSourcesPage.buttons.exploreSqlEditorMode.click({ timeout: Timeouts.THIRTY_SECONDS });
      });

      await pmmTest.step('Enter the SQL query', async () => {
        await dataSourcesPage.setExploreSqlQuery(query);
        await expect(dataSourcesPage.elements.exploreSqlEditorLines).toHaveText(query);
      });

      await pmmTest.step('Run the query and verify it returns rows', async () => {
        await dataSourcesPage.buttons.exploreRunSqlQuery.click();
        await expect(dataSourcesPage.elements.exploreResultRows.visible()).not.toHaveCount(0, {
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(dataSourcesPage.messages.exploreAuthenticationFailed).toBeHidden();
      });
    },
  );

  pmmTest(
    'PMM-T2018 - Verify internal clickhouse is not running when using external clickhouse @docker-configuration',
    async ({ cliHelper }) => {
      const status = cliHelper.execute(`docker exec ${pmmServerContainer} supervisorctl status`);

      expect(status.code, 'supervisorctl status should exit non-zero').not.toBe(0);
      expect(status.stdout, 'supervisorctl status should list the PMM Server programs').toContain(
        'pmm-managed',
      );
      expect(status.stdout, 'Clickhouse should not run on pmm server!').not.toContain('clickhouse');
    },
  );

  pmmTest(
    'PMM-T2019 - Verify pmm managed logs do not contain errors about clickhouse @docker-configuration',
    async ({ cliHelper }) => {
      const pmmManagedLogs = cliHelper
        .execSilent(
          `docker exec ${pmmServerContainer} sh -c 'grep clickhouse /srv/logs/pmm-managed.log; [ $? -le 1 ]'`,
        )
        .assertSuccess().stdout;
      const qanLogs = cliHelper
        .execSilent(
          `docker exec ${pmmServerContainer} sh -c 'grep clickhouse /srv/logs/qan-api2.log; [ $? -le 1 ]'`,
        )
        .assertSuccess().stdout;

      expect(pmmManagedLogs, 'PMM managed logs should not contain error about clickhouse.').not.toContain(
        'ClickHouse DB is not reachable',
      );
      expect(pmmManagedLogs, 'PMM managed logs should not contain error about clickhouse.').not.toContain(
        'Failed to parse ClickHouse DSN',
      );
      expect(
        pmmManagedLogs,
        'PMM managed logs should not contain clickhouse password in plain text',
      ).not.toContain('pmm_pass');
      expect(qanLogs, 'QAN logs should not contain clickhouse password in plain text').not.toContain(
        'pmm_pass',
      );
    },
  );

  pmmTest(
    'PMM-T2006 - Verify using ClickHouse Username and password variables for external databases @docker-configuration',
    async ({ dashboard, page, qanStoredMetrics, urlHelper }) => {
      await pmmTest.step('Verify MySQL Instances Overview has data', async () => {
        await dashboard.verifyNoDataPanelsAtMost(
          urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceOverview.url, {
            from: 'now-5m',
            to: 'now',
          }),
          12,
        );
      });

      await pmmTest.step('Verify Query Analytics has data', async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }),
        );
        await qanStoredMetrics.waitForLoad();
        await expect(qanStoredMetrics.elements.queryRows.visible()).not.toHaveCount(0);
      });
    },
  );
});
