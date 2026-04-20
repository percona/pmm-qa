import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

const TABLES_COUNT = 10;
const ITERATIONS = 3;
const MIN_LENGTH = 100;
const MAX_LENGTH = 220;
const SETUP_SQL = 'testdata/vacuumDashboardSetup.sql';
const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
let pgsqlContainerName: string;

pmmTest.beforeAll(async ({ cliHelper }) => {
  pgsqlContainerName = cliHelper
    .execSilent('docker ps -f name=pgsql --format "{{ .Names }}"')
    .stdout.trim()
    .split(/\r?\n/)[0];

  if (!pgsqlContainerName) throw new Error('No running container matching "pgsql" was found.');

  cliHelper
    .execSilent(`docker exec -i ${pgsqlContainerName} psql -U postgres -v ON_ERROR_STOP=1 < ${SETUP_SQL}`)
    .assertSuccess();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T1365 - Verify PostgreSQL Vacuum monitoring dashboard @dashboards @experimental @pmm-pgsql-integration',
  async ({ cliHelper, page, urlHelper, vacuumDashboardPage }) => {
    await pmmTest.step('Churn rows to produce vacuum/analyze activity', async () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const table = randomInRange(1, TABLES_COUNT);
        const oldLength = randomInRange(MIN_LENGTH, MAX_LENGTH);
        const newLength = randomInRange(MIN_LENGTH, MAX_LENGTH);
        const churnSql = [
          `DELETE FROM film_testing_${table} WHERE length = ${oldLength};`,
          `INSERT INTO film_testing_${table} (id, title, description, length)`,
          `  SELECT g, 'title for ' || g, 'Description for ' || g, ${oldLength}`,
          `  FROM generate_series(1, 50) g;`,
          `UPDATE film_testing_${table} SET length = ${newLength} WHERE length = ${oldLength};`,
        ].join(' ');

        cliHelper
          .execSilent(`docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -c "${churnSql}"`)
          .assertSuccess();

        // eslint-disable-next-line playwright/no-wait-for-timeout -- give PMM time to scrape updated stats
        await page.waitForTimeout(Timeouts.FIVE_SECONDS);
      }
    });

    await page.goto(
      urlHelper.buildUrlWithParameters(vacuumDashboardPage.url, {
        from: 'now-5m',
        refresh: '10s',
        serviceName: pgsqlContainerName,
      }),
    );

    await expect(vacuumDashboardPage.elements.barWithValue.first()).toBeVisible({
      timeout: Timeouts.FIVE_MINUTES,
    });

    const allTables = cliHelper
      .execSilent(
        `docker exec ${pgsqlContainerName} psql -U postgres -d dvdrental -t -A -c "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"`,
      )
      .stdout.split(/\r?\n/);

    await vacuumDashboardPage.vacuumAnalyzeTables(allTables, pgsqlContainerName);
    await vacuumDashboardPage.waitForLastVacuumValues(Timeouts.TEN_MINUTES);
    await vacuumDashboardPage.waitForLastAnalyzeValues(Timeouts.TEN_MINUTES);
  },
);
