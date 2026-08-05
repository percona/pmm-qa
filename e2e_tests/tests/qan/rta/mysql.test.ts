import { readFile } from 'node:fs/promises';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

// Mocked responses must use the wire format (snake_case, like the real API);
// the UI camelizes them client-side via axios-case-converter.
const buildMySqlQuery = (overrides: {
  database?: string;
  queryId: string;
  queryText: string;
  username?: string;
}) => ({
  client_address: '127.0.0.1:52134',
  my_sql_payload: {
    command: 'Query',
    database_name: overrides.database ?? 'sbtest',
    db_instance_address: '127.0.0.1:3307',
    full_scan: false,
    program_name: 'sysbench',
    rows_examined: '100',
    rows_sent: '10',
    state: 'executing',
    username: overrides.username ?? 'sbtest@localhost',
  },
  query_collect_time: new Date().toISOString(),
  query_execution_duration: '2s',
  query_id: overrides.queryId,
  query_raw_json: JSON.stringify({ current_statement: overrides.queryText }),
  query_text: overrides.queryText,
  service_id: 'mock-mysql-service',
  service_name: 'mock-mysql-service',
});
const buildMongoDbQuery = (overrides: { queryId: string; queryText: string }) => ({
  client_address: '127.0.0.1:41234',
  mongo_db_payload: {
    client_app_name: 'mongosh',
    collection: 'mycollection',
    database_name: 'admin',
    db_instance_address: '127.0.0.1:27017',
    operation: 'query',
    operation_start_time: new Date().toISOString(),
    plan_summary: 'COLLSCAN',
    username: 'pmm-mongo',
  },
  query_collect_time: new Date().toISOString(),
  query_execution_duration: '3s',
  query_id: overrides.queryId,
  query_raw_json: JSON.stringify({ op: 'query' }),
  query_text: overrides.queryText,
  service_id: 'mock-mongo-service',
  service_name: 'mock-mongo-service',
});

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const [service] = await api.inventoryApi.getServicesByType(ServiceType.mysql);

  await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
  await page.goto(queryAnalytics.rta.getUrlWithServices([service.service_id]));
});

pmmTest(
  'Verify RTA overview shows running MySQL queries with database and user @rta',
  async ({ api, mySqlDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-mysql-overview';
    const [service] = await api.inventoryApi.getServicesByType(ServiceType.mysql);

    await pmmTest.step('Simulate long running MySQL query', async () => {
      void mySqlDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel,
      });

      await expect(queryAnalytics.rta.builders.rowByQueryText(queryLabel)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Pause RTA and filter query list', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText(queryLabel);
    });

    await pmmTest.step('Verify host, database and user columns for the MySQL row', async () => {
      await expect(queryAnalytics.rta.builders.hostForRow('1')).toHaveText(service.service_name);

      await queryAnalytics.rta.showColumns('Database', 'User');

      await expect(queryAnalytics.rta.builders.databaseForRow('1')).toHaveText('test');
      await expect(queryAnalytics.rta.builders.userForRow('1')).toContainText('msandbox');
    });
  },
);

pmmTest(
  'Verify MySQL query details pane shows MySQL-specific attributes and raw data @rta',
  async ({ mySqlDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-mysql-details';

    await pmmTest.step('Simulate long running MySQL query', async () => {
      void mySqlDbHelper.simulateLongRunningQuery({
        delayMs: Timeouts.THIRTY_SECONDS,
        queryLabel,
      });

      await expect(queryAnalytics.rta.builders.rowByQueryText(queryLabel)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Pause RTA and open details for the MySQL query', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText(queryLabel);
      await queryAnalytics.rta.openDetailsForRow('1');
    });

    await pmmTest.step('Verify MySQL-specific attributes', async () => {
      await expect(queryAnalytics.rta.builders.detailsPaneCodeByText(queryLabel)).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsCommand).toHaveText('Query');
      await expect(queryAnalytics.rta.elements.detailsState).not.toBeEmpty();
      await expect(queryAnalytics.rta.elements.detailsUsername).toContainText('msandbox');
      await expect(queryAnalytics.rta.elements.detailsRowsExamined).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsRowsSent).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsFullScan).toBeVisible();
    });

    await pmmTest.step('Verify raw data tab shows the full processlist row', async () => {
      await queryAnalytics.rta.buttons.detailsRawDataTab.click();

      await expect(queryAnalytics.rta.elements.detailsRawData).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsRawData).toContainText(queryLabel);
      await expect(queryAnalytics.rta.elements.detailsRawData).toContainText('conn_id');
    });
  },
);

pmmTest(
  'Verify Hide COMMIT toggle filters transaction-control statements @rta',
  async ({ page, queryAnalytics }) => {
    await pmmTest.step('Mock RTA search response with COMMIT and SELECT queries', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [
              buildMySqlQuery({ queryId: '101', queryText: 'COMMIT' }),
              buildMySqlQuery({ queryId: '102', queryText: 'SELECT c FROM sbtest1 WHERE id=42' }),
            ],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.builders.rowByQueryText('COMMIT')).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
    });

    await pmmTest.step('Enable Hide COMMIT and verify the COMMIT row disappears', async () => {
      await queryAnalytics.rta.toggleHideCommit();

      await expect(queryAnalytics.rta.builders.rowByQueryText('COMMIT')).toHaveCount(0);
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
    });

    await pmmTest.step('Disable Hide COMMIT and verify the COMMIT row is back', async () => {
      await queryAnalytics.rta.toggleHideCommit();

      await expect(queryAnalytics.rta.builders.rowByQueryText('COMMIT')).toBeVisible();
    });
  },
);

pmmTest(
  'Verify Database and User text filters support comma-separated lazy matching @rta',
  async ({ page, queryAnalytics }) => {
    await pmmTest.step('Mock RTA search response with queries from three databases', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [
              buildMySqlQuery({
                database: 'sbtest',
                queryId: '201',
                queryText: 'SELECT c FROM sbtest1 WHERE id=1',
                username: 'sbtest@localhost',
              }),
              buildMySqlQuery({
                database: 'orders',
                queryId: '202',
                queryText: 'SELECT id FROM orders WHERE status=1',
                username: 'app@localhost',
              }),
              buildMySqlQuery({
                database: 'inventory',
                queryId: '203',
                queryText: 'SELECT sku FROM inventory WHERE qty=0',
                username: 'app@localhost',
              }),
            ],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Filter by a partial database name (lazy match)', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.showColumns('Database', 'User');
      await queryAnalytics.rta.openFilters();
      await queryAnalytics.rta.filterByColumnText('Database', 'sbt');

      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1);
    });

    await pmmTest.step('Filter by a comma-separated database list (any term matches)', async () => {
      await queryAnalytics.rta.filterByColumnText('Database', 'sbtest, ord');

      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT id FROM orders')).toBeVisible();
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT sku FROM inventory')).toHaveCount(0);
    });

    await pmmTest.step('Combine with a User filter that matches none of the remaining rows', async () => {
      await queryAnalytics.rta.filterByColumnText('Database', 'orders');
      await queryAnalytics.rta.filterByColumnText('User', 'sbtest@localhost');

      await expect(queryAnalytics.rta.elements.noFilterResults).toBeVisible();
    });
  },
);

pmmTest(
  'Verify Database and User columns are hidden by default and can be revealed @rta',
  async ({ page, queryAnalytics }) => {
    await pmmTest.step('Mock RTA search response with a MySQL query', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [buildMySqlQuery({ queryId: '501', queryText: 'SELECT c FROM sbtest1 WHERE id=21' })],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Verify only the default columns are shown', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

      await expect(queryAnalytics.rta.elements.queryTextColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.hostColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.elapsedTimeColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.databaseColumnHeader).toBeHidden();
      await expect(queryAnalytics.rta.elements.userColumnHeader).toBeHidden();
      await expect(queryAnalytics.rta.builders.databaseForRow('1')).toHaveCount(0);
      await expect(queryAnalytics.rta.builders.userForRow('1')).toHaveCount(0);
    });

    await pmmTest.step('Reveal Database and User and verify their values', async () => {
      await queryAnalytics.rta.showColumns('Database', 'User');

      await expect(queryAnalytics.rta.elements.databaseColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.userColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.builders.databaseForRow('1')).toHaveText('sbtest');
      await expect(queryAnalytics.rta.builders.userForRow('1')).toHaveText('sbtest@localhost');
    });
  },
);

pmmTest(
  'Verify elapsed time is rendered in compact seconds format @rta',
  async ({ page, queryAnalytics }) => {
    await pmmTest.step('Mock RTA search response with a two-second query', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [buildMySqlQuery({ queryId: '601', queryText: 'SELECT c FROM sbtest1 WHERE id=34' })],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Verify the elapsed time cell uses the unit suffix, not the word', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

      await expect(queryAnalytics.rta.builders.elapsedTimeForRow('1')).toHaveText('2.000s');
    });
  },
);

pmmTest(
  'Verify overview renders MongoDB and MySQL queries side by side @rta',
  async ({ page, queryAnalytics }) => {
    const mongoQueryText = '{ find: "mycollection", filter: { status: "active" } }';
    const mySqlQueryText = 'SELECT c FROM sbtest1 WHERE id=7';

    await pmmTest.step('Mock RTA search response with one query per engine', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [
              buildMongoDbQuery({ queryId: '301', queryText: mongoQueryText }),
              buildMySqlQuery({ queryId: '302', queryText: mySqlQueryText }),
            ],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(2, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Verify each row resolves database and user from its own payload', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.showColumns('Database', 'User');

      const mongoRow = queryAnalytics.rta.builders.rowByQueryText('find: "mycollection"');
      const mySqlRow = queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1');

      await expect(mongoRow).toContainText('admin');
      await expect(mongoRow).toContainText('pmm-mongo');
      await expect(mySqlRow).toContainText('sbtest');
      await expect(mySqlRow).toContainText('sbtest@localhost');
    });

    await pmmTest.step('Verify details pane switches payload-specific fields per engine', async () => {
      await queryAnalytics.rta.builders.rowByQueryText('find: "mycollection"').click();
      await expect(queryAnalytics.rta.elements.detailsPane).toBeVisible();

      // MongoDB-only fields visible, MySQL-only fields absent.
      await expect(queryAnalytics.rta.elements.detailsPane.getByTestId('collection-value')).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsCommand).toBeHidden();

      await queryAnalytics.rta.buttons.detailsNextQuery.click();

      // And the other way around for the MySQL row.
      await expect(queryAnalytics.rta.elements.detailsCommand).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsPane.getByTestId('collection-value')).toBeHidden();

      await queryAnalytics.rta.buttons.closeDetailsPane.click();
    });
  },
);

pmmTest(
  'Verify RTA CSV export contains MySQL-specific columns @rta',
  async ({ page, queryAnalytics }, testInfo) => {
    await pmmTest.step('Mock RTA search response with a MySQL query', async () => {
      await page.route(apiEndpoints.realtimeanalytics.queriesSearch, (route) =>
        route.fulfill({
          body: JSON.stringify({
            queries: [buildMySqlQuery({ queryId: '401', queryText: 'SELECT c FROM sbtest1 WHERE id=13' })],
          }),
          contentType: 'application/json',
          status: 200,
        }),
      );
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Export CSV and verify the MySQL columns and values', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

      const downloadPromise = page.waitForEvent('download');

      await queryAnalytics.rta.buttons.export.click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/^rta_export_\d{8}_\d{6}\.csv$/);

      const csvPath = testInfo.outputPath(download.suggestedFilename());

      await download.saveAs(csvPath);

      const csvContent = await readFile(csvPath, 'utf8');

      for (const column of ['command', 'state', 'program_name', 'rows_examined', 'rows_sent', 'full_scan']) {
        expect(csvContent).toContain(column);
      }

      expect(csvContent).toContain('Query');
      expect(csvContent).toContain('sysbench');
      expect(csvContent).toContain('sbtest@localhost');
    });
  },
);
