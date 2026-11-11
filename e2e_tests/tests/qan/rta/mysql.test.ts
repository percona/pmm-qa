import { readFile } from 'node:fs/promises';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

let mySqlServiceId: string;

pmmTest.beforeEach(async ({ api, grafanaHelper, page, queryAnalytics }) => {
  await grafanaHelper.authorize();

  const [service] = await api.inventoryApi.getServicesByType(ServiceType.mysql);

  mySqlServiceId = service.service_id;
  await api.realTimeAnalyticsApi.startRealTimeAnalytics(mySqlServiceId);
  await page.goto(queryAnalytics.rta.getUrlWithServices([mySqlServiceId]));
});

pmmTest.afterEach(async ({ api }) => {
  await api.realTimeAnalyticsApi.stopRealTimeAnalytics(mySqlServiceId);
});

pmmTest(
  'Verify RTA overview shows running MySQL queries with database and user @rta',
  async ({ api, mySqlDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-mysql-overview';
    const [service] = await api.inventoryApi.getServicesByType(ServiceType.mysql);

    await pmmTest.step('Simulate long running MySQL query', async () => {
      void mySqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

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

      await expect(queryAnalytics.rta.builders.databaseForRow('1')).toHaveText('mysql');
      await expect(queryAnalytics.rta.builders.userForRow('1')).toContainText('root');
    });
  },
);

pmmTest(
  'Verify MySQL query details pane shows MySQL-specific attributes and raw data @rta',
  async ({ mySqlDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-mysql-details';

    await pmmTest.step('Simulate long running MySQL query', async () => {
      void mySqlDbHelper.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });

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
      await expect(queryAnalytics.rta.elements.detailsUsername).toContainText('root');
      await expect(queryAnalytics.rta.elements.detailsRowsExamined).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsRowsSent).toBeVisible();
      await expect(queryAnalytics.rta.elements.detailsFullScan).toBeVisible();
    });

    await pmmTest.step('Verify raw data tab shows the full processlist row', async () => {
      await queryAnalytics.rta.buttons.detailsRawDataTab.click();

      await expect(queryAnalytics.rta.elements.detailsRawData).toContainText(queryLabel);
      await expect(queryAnalytics.rta.elements.detailsRawData).toContainText('conn_id');
    });
  },
);

pmmTest(
  'Verify a MySQL row-lock wait shows the Blocked by chip and panel @rta',
  async ({ mySqlDbHelper, queryAnalytics }) => {
    const queryLabel = 'rta-mysql-row-lock';
    const holderId = await mySqlDbHelper.simulateRowLockWait(queryLabel);

    await pmmTest.step('Pause RTA on the waiting statement', async () => {
      await expect(queryAnalytics.rta.builders.blockedChipForQuery(queryLabel)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.filterQueriesByText(queryLabel);
    });

    await pmmTest.step('Verify the chip and the Blocked by panel name the lock holder', async () => {
      await expect(queryAnalytics.rta.builders.blockedChipForQuery(queryLabel)).toHaveText(
        `Blocked by ${holderId}`,
      );

      await queryAnalytics.rta.openDetailsForRow('1');

      await expect(queryAnalytics.rta.elements.blockedByHeading).toHaveText(`Blocked by ${holderId}`);
      await expect(queryAnalytics.rta.elements.blockedWaitDuration).toContainText('waiting');
      await expect(queryAnalytics.rta.elements.blockedByPanel).toContainText('Row lock (InnoDB)');
    });
  },
);

pmmTest(
  'Verify Blocked only toggle keeps blocked and undecided statements @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await pmmTest.step('Mock a blocked, a running and an unattributed statement', async () => {
      await mocks.mockRealTimeAnalyticsQueries([
        {
          mySqlPayload: {
            blocked_by: [
              {
                blocking_command: 'Query',
                blocking_conn_id: '77',
                blocking_query: 'UPDATE sbtest1 SET c=? WHERE id=7',
                blocking_username: 'app',
                root: true,
                wait_duration: '3s',
              },
            ],
            blocked_status: 'BLOCKED_STATUS_BLOCKED',
            lock_time: '0.0125s',
            lock_type: 'LOCK_TYPE_ROW',
            locked_table: '`sbtest`.`sbtest1`',
          },
          queryId: '901',
          queryText: 'UPDATE sbtest1 SET k=k+1 WHERE id=7',
        },
        { queryId: '902', queryText: 'SELECT c FROM sbtest1 WHERE id=8' },
        {
          mySqlPayload: { blocked_status: 'BLOCKED_STATUS_UNATTRIBUTED' },
          queryId: '903',
          queryText: 'DELETE FROM sbtest1 WHERE id=9',
        },
      ]);
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    });

    await pmmTest.step('Verify the blocked chips and the toggle count', async () => {
      await expect(queryAnalytics.rta.builders.blockedChipForQuery('UPDATE sbtest1 SET k')).toHaveText(
        'Blocked by 77',
      );
      await expect(queryAnalytics.rta.builders.blockedUnknownChipForQuery('DELETE FROM sbtest1')).toHaveText(
        'Possibly blocked',
      );
      await expect(queryAnalytics.rta.builders.blockedChipForQuery('SELECT c FROM sbtest1')).toHaveCount(0);
      await expect(queryAnalytics.rta.toggles.blockedOnly).toHaveText('Blocked only (1)');
    });

    await pmmTest.step('Enable Blocked only and verify only the running statement is hidden', async () => {
      await queryAnalytics.rta.toggles.blockedOnly.click();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toHaveCount(0);
    });

    await pmmTest.step('Verify the details pane shows the Blocked by panel and lock time', async () => {
      await queryAnalytics.rta.builders.rowByQueryText('UPDATE sbtest1 SET k').click();

      await expect(queryAnalytics.rta.elements.blockedByHeading).toHaveText('Blocked by 77');
      await expect(queryAnalytics.rta.elements.blockerQuery).toContainText(
        'UPDATE sbtest1 SET c=? WHERE id=7',
      );
      await expect(queryAnalytics.rta.elements.detailsLockTime).toHaveText('12.5 ms');
    });
  },
);

pmmTest(
  'Verify Blocked only toggle reads Blocked unknown when lock information is missing @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsQueries([
      {
        mySqlPayload: { blocked_status: undefined },
        queryId: '911',
        queryText: 'SELECT c FROM sbtest1 WHERE id=11',
      },
    ]);
    await page.reload();

    await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect(queryAnalytics.rta.toggles.blockedOnly).toHaveText('Blocked unknown');
    await expect(queryAnalytics.rta.toggles.blockedOnlySwitch).toBeDisabled();
  },
);

pmmTest(
  'Verify the Truncated chip marks a cut-off MySQL statement @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsQueries([
      {
        mySqlPayload: { query_text_truncated: true },
        queryId: '921',
        queryText: 'SELECT c FROM sbtest1 WHERE id IN (1, 2',
      },
      { queryId: '922', queryText: 'SELECT k FROM sbtest2 WHERE id=3' },
    ]);
    await page.reload();

    await expect(queryAnalytics.rta.builders.truncatedChipForQuery('SELECT c FROM sbtest1')).toHaveText(
      'Truncated',
      {
        timeout: Timeouts.TEN_SECONDS,
      },
    );
    await expect(queryAnalytics.rta.builders.truncatedChipForQuery('SELECT k FROM sbtest2')).toHaveCount(0);
  },
);

pmmTest(
  'Verify Hide transaction control toggle filters transaction-control statements @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await pmmTest.step('Mock BEGIN, COMMIT and SELECT statements', async () => {
      await mocks.mockRealTimeAnalyticsQueries([
        { queryId: '101', queryText: 'BEGIN' },
        { queryId: '102', queryText: 'COMMIT' },
        { queryId: '103', queryText: 'SELECT c FROM sbtest1 WHERE id=42' },
      ]);
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Enable the toggle and verify BEGIN and COMMIT disappear', async () => {
      await expect(queryAnalytics.rta.toggles.hideBeginCommit).toHaveText('Hide transaction control');

      await queryAnalytics.rta.toggles.hideBeginCommit.click();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1);
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
    });

    await pmmTest.step('Disable the toggle and verify they are back', async () => {
      await queryAnalytics.rta.toggles.hideBeginCommit.click();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(3);
    });
  },
);

pmmTest(
  'Verify Database and User text filters support comma-separated lazy matching @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await pmmTest.step('Mock queries from three databases', async () => {
      await mocks.mockRealTimeAnalyticsQueries([
        {
          database: 'sbtest',
          queryId: '201',
          queryText: 'SELECT c FROM sbtest1 WHERE id=1',
          username: 'sbtest@localhost',
        },
        {
          database: 'orders',
          queryId: '202',
          queryText: 'SELECT id FROM orders WHERE status=1',
          username: 'app@localhost',
        },
        {
          database: 'inventory',
          queryId: '203',
          queryText: 'SELECT sku FROM inventory WHERE qty=0',
          username: 'app@localhost',
        },
      ]);
      await page.reload();

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(3, {
        timeout: Timeouts.TEN_SECONDS,
      });
    });

    await pmmTest.step('Filter by a partial database name', async () => {
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
      await queryAnalytics.rta.showColumns('Database', 'User');
      await queryAnalytics.rta.openFilters();
      await queryAnalytics.rta.builders.columnFilter('Database').fill('sbt');

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1);
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT c FROM sbtest1')).toBeVisible();
    });

    await pmmTest.step('Filter by a comma-separated database list', async () => {
      await queryAnalytics.rta.builders.columnFilter('Database').fill('sbtest, ord');

      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(2);
      await expect(queryAnalytics.rta.builders.rowByQueryText('SELECT sku FROM inventory')).toHaveCount(0);
    });

    await pmmTest.step('Combine with a User filter that matches none of the remaining rows', async () => {
      await queryAnalytics.rta.builders.columnFilter('Database').fill('orders');
      await queryAnalytics.rta.builders.columnFilter('User').fill('sbtest@localhost');

      await expect(queryAnalytics.rta.elements.noQueriesAvailable).toBeVisible();
    });
  },
);

pmmTest(
  'Verify Database and User columns are hidden by default and can be revealed @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsQueries([
      { queryId: '501', queryText: 'SELECT c FROM sbtest1 WHERE id=21' },
    ]);
    await page.reload();

    await pmmTest.step('Verify only the default columns are shown', async () => {
      await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
        timeout: Timeouts.TEN_SECONDS,
      });
      await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

      await expect(queryAnalytics.rta.elements.queryTextColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.hostColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.elapsedTimeColumnHeader).toBeVisible();
      await expect(queryAnalytics.rta.elements.databaseColumnHeader).toBeHidden();
      await expect(queryAnalytics.rta.elements.userColumnHeader).toBeHidden();
    });

    await pmmTest.step('Reveal Database and User and verify their values', async () => {
      await queryAnalytics.rta.showColumns('Database', 'User');

      await expect(queryAnalytics.rta.builders.databaseForRow('1')).toHaveText('sbtest');
      await expect(queryAnalytics.rta.builders.userForRow('1')).toHaveText('sbtest@localhost');
    });
  },
);

pmmTest(
  'Verify Elapsed time stays pinned and no column can be pinned by hand @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsQueries([
      { queryId: '701', queryText: 'SELECT c FROM sbtest1 WHERE id=55' },
    ]);
    await page.reload();

    await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

    await expect(queryAnalytics.rta.builders.elapsedTimeForRow('1')).toHaveAttribute('data-pinned', 'true');

    await queryAnalytics.rta.buttons.showHideColumns.click();

    await expect(queryAnalytics.rta.elements.columnsMenu).toBeVisible();
    await expect(queryAnalytics.rta.elements.columnPinButtons).toHaveCount(0);
  },
);

pmmTest(
  'Verify elapsed time is rendered with milliseconds and a unit @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsQueries([
      { duration: '1.5s', queryId: '601', queryText: 'SELECT c FROM sbtest1 WHERE id=34' },
    ]);
    await page.reload();

    await expect(queryAnalytics.rta.builders.elapsedTimeForRow('1')).toHaveText('1.500 s', {
      timeout: Timeouts.TEN_SECONDS,
    });
  },
);

pmmTest(
  'Verify the overview picker refuses to mix technologies @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsSessionsOf([
      { serviceId: 'mock-mysql-service', serviceType: 'SERVICE_TYPE_MYSQL_SERVICE' },
      { serviceId: 'mock-mongo-service', serviceType: 'SERVICE_TYPE_MONGODB_SERVICE' },
    ]);
    await page.goto(queryAnalytics.rta.getUrlWithServices(['mock-mysql-service']));
    await queryAnalytics.rta.buttons.openServices.click();

    await expect(queryAnalytics.rta.builders.serviceOption('mock-mysql-service')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(queryAnalytics.rta.builders.serviceOption('mock-mongo-service')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(queryAnalytics.rta.builders.technologyGroupHeader('MySQL')).toBeVisible();
    await expect(queryAnalytics.rta.builders.technologyGroupHeader('MongoDB')).toBeVisible();
  },
);

pmmTest(
  'Verify Database, User and the MySQL toggles are not offered for MongoDB @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsSessionsOf([
      { serviceId: 'mock-mongo-service', serviceType: 'SERVICE_TYPE_MONGODB_SERVICE' },
    ]);
    await mocks.mockRealTimeAnalyticsQueries([
      { mongoDb: true, queryId: '801', queryText: '{ find: "mycollection", filter: { status: "active" } }' },
    ]);
    await page.goto(queryAnalytics.rta.getUrlWithServices(['mock-mongo-service']));

    await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();
    await queryAnalytics.rta.buttons.showHideColumns.click();

    await expect(queryAnalytics.rta.elements.columnsMenu).toBeVisible();
    await expect(queryAnalytics.rta.builders.columnToggle('Database')).toHaveCount(0);
    await expect(queryAnalytics.rta.builders.columnToggle('User')).toHaveCount(0);
    await expect(queryAnalytics.rta.toggles.hideBeginCommit).toHaveCount(0);
    await expect(queryAnalytics.rta.toggles.blockedOnly).toHaveCount(0);
  },
);

pmmTest(
  'Verify the sessions list names the technology of every session @rta',
  async ({ mocks, page, queryAnalytics }) => {
    await mocks.mockRealTimeAnalyticsSessionsOf([
      { serviceId: 'mock-mysql-service', serviceType: 'SERVICE_TYPE_MYSQL_SERVICE' },
      { serviceId: 'mock-mongo-service', serviceType: 'SERVICE_TYPE_MONGODB_SERVICE' },
    ]);
    await page.goto(queryAnalytics.rta.sessionsUrl);

    await expect(queryAnalytics.rta.elements.technologyColumnHeader).toBeVisible({
      timeout: Timeouts.TEN_SECONDS,
    });
    await expect(queryAnalytics.rta.builders.technologyForSession('mock-mysql-service')).toHaveText('MySQL');
    await expect(queryAnalytics.rta.builders.technologyForSession('mock-mongo-service')).toHaveText(
      'MongoDB',
    );
  },
);

pmmTest(
  'Verify a running session with a status message explains it in a tooltip @rta',
  async ({ mocks, page, queryAnalytics }) => {
    const statusMessage = 'Metadata locks cannot be read: performance_schema.metadata_locks is not enabled.';

    await mocks.mockRealTimeAnalyticsSessionsOf([
      { serviceId: 'mock-mysql-service', serviceType: 'SERVICE_TYPE_MYSQL_SERVICE', statusMessage },
    ]);
    await page.goto(queryAnalytics.rta.sessionsUrl);
    await queryAnalytics.rta.elements.sessionStatusMessage.hover();

    await expect(queryAnalytics.rta.elements.sessionStatusMessageTooltip).toContainText(
      'The session is running, but some details cannot be collected from this instance:',
    );
    await expect(queryAnalytics.rta.elements.sessionStatusMessageTooltip).toContainText(statusMessage);
  },
);

pmmTest(
  'Verify RTA CSV export of MySQL queries is named for MySQL and has its columns @rta',
  async ({ mocks, page, queryAnalytics }, testInfo) => {
    await mocks.mockRealTimeAnalyticsQueries([
      { queryId: '401', queryText: 'SELECT c FROM sbtest1 WHERE id=13' },
    ]);
    await page.reload();

    await expect(queryAnalytics.rta.elements.realTimeTableRow).toHaveCount(1, {
      timeout: Timeouts.TEN_SECONDS,
    });
    await queryAnalytics.rta.buttons.pauseRealTimeAnalytics.click();

    const downloadPromise = page.waitForEvent('download');

    await queryAnalytics.rta.buttons.export.click();

    const download = await downloadPromise;
    const csvPath = testInfo.outputPath(download.suggestedFilename());

    expect(download.suggestedFilename()).toMatch(/^mysql_rta_export_\d{8}_\d{6}\.csv$/);

    await download.saveAs(csvPath);

    const csvContent = await readFile(csvPath, 'utf8');

    for (const column of [
      'command',
      'state',
      'program_name',
      'rows_examined',
      'rows_sent',
      'full_scan',
      'blocked_status',
      'query_text_truncated',
    ]) {
      expect(csvContent).toContain(column);
    }

    expect(csvContent).toContain('sysbench');
    expect(csvContent).toContain('sbtest@localhost');
  },
);
