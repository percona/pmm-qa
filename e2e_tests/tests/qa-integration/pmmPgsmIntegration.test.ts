import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { AgentType, CliAgentStatus } from '@helpers/constants';
import { QanLabel } from '@api/qan.api';
import { Timeouts } from '@helpers/timeouts';

const connection = {
  password: 'pass+this',
  user: 'postgres',
};
const version = process.env.PDPGSQL_VERSION ? process.env.PDPGSQL_VERSION : '17';
const versionNumber = parseInt(version, 10);
const database = `pgsm${Math.floor(Math.random() * 99) + 1}`;
const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const percentageDiff = (a: number, b: number) => (a - b === 0 ? 0 : 100 * Math.abs((a - b) / b));
let containerName: string;
let pgsmServiceName: string;
let pgsmServiceNameSocket: string;

pmmTest.describe('PMM + PGSM Integration Scenarios', () => {
  pmmTest.beforeEach(async ({ api, cliHelper, grafanaHelper }) => {
    containerName = cliHelper.execSilent(`docker ps --format '{{.Names}}' | grep pdpgsql`).stdout.trim();
    pgsmServiceName = (await api.inventoryApi.getServiceDetailsByPartialName('pdpgsql_')).service_name;
    pgsmServiceNameSocket = (await api.inventoryApi.getServiceDetailsByPartialName('socket_pdpgsql_'))
      .service_name;
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T1728 - pg_stat_monitor agent does not continuously try to create pg_stat_monitor_settings view @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper, pgsqlHelper }) => {
      const log = cliHelper.execSilent(
        `docker exec ${containerName} cat /var/log/postgresql/postgresql-${version}-main.log`,
      ).stdout;

      expect(log).not.toContain('relation "pg_stat_monitor_settings" already exists');
      expect(log).not.toContain(
        'STATEMENT: CREATE VIEW pg_stat_monitor_settings AS SELECT * FROM pg_settings',
      );

      const views = pgsqlHelper.queryRows<{ table_name: string }>(
        'select table_name from INFORMATION_SCHEMA.views',
        { container: containerName },
      );

      expect(
        views.map((view) => view.table_name),
        'PG should not have "pg_stat_monitor_settings" view',
      ).not.toContain('pg_stat_monitor_settings');
    },
  );

  pmmTest(
    'PMM-T1867 - pg_stat_monitor is used by default without providing --query-source @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper }) => {
      const serviceName = `pgsm_${Math.floor(Math.random() * 99) + 1}`;
      const addOutput = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin add postgresql --json --password=${connection.password} --username=${connection.user} --service-name=${serviceName}`,
        )
        .assertSuccess().stdout;
      const serviceId = JSON.parse(addOutput).service.service_id;
      let serviceAgents: { agent_type: string; status: string }[] = [];

      await expect
        .poll(
          () => {
            const list = JSON.parse(
              cliHelper.execSilent(`docker exec ${containerName} pmm-admin list --json`).stdout,
            );

            serviceAgents = list.agent.filter(
              (agent: { service_id: string }) => agent.service_id === serviceId,
            );

            return serviceAgents.find((agent) => agent.agent_type === AgentType.qanPgStatMonitor)?.status;
          },
          { intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.THIRTY_SECONDS },
        )
        .toEqual(CliAgentStatus.running);

      expect(
        serviceAgents.find((agent) => agent.agent_type === AgentType.qanPgStatStatements),
        'pg_stat_statements agent should not exist',
      ).toBeUndefined();
    },
  );

  pmmTest(
    'PMM-T1260 - Verifying data in Clickhouse and comparing with PGSM output @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ api, cliHelper, pgsqlHelper }) => {
      pgsqlHelper.exec('SELECT now();', { container: containerName }).assertSuccess();
      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });

      const dbExists = pgsqlHelper.queryRows(`SELECT * FROM pg_database where datname = '${database}';`, {
        container: containerName,
      });

      if (dbExists.length === 0) {
        pgsqlHelper.exec(`Create database ${database};`, { container: containerName }).assertSuccess();
      }

      pgsqlHelper.runSqlFile('testdata/pgsql/pgsm_load.sql', {
        container: containerName,
        database,
      });
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`,
        )
        .assertSuccess();

      // Wait for pmm-agent to push the current bucket to ClickHouse.
      await sleep(Timeouts.THIRTY_SECONDS);

      const selectColumns =
        versionNumber < 13
          ? 'query, pgsm_query_id, planid, query_plan, calls, total_time as total_exec_time, mean_time as mean_exec_time'
          : 'query, pgsm_query_id, planid, query_plan, calls, total_exec_time, mean_exec_time';
      const pgsmRows = pgsqlHelper.queryRows<{
        calls: string;
        mean_exec_time: number;
        pgsm_query_id: string;
        query: string;
        total_exec_time: number;
      }>(
        `select ${selectColumns} from pg_stat_monitor where datname='${database}' and query NOT IN ('SELECT version()', 'SELECT /* pmm-agent:pgstatmonitor */ version()') and query NOT LIKE '%current_database() datname%'`,
        { container: containerName },
      );

      await sleep(Timeouts.TWO_MINUTES + Timeouts.THIRTY_SECONDS);

      const now = Date.now();
      const fromStart = new Date(now - 10 * 60_000).toISOString();
      const toStart = new Date(now + 10 * 60_000).toISOString();
      const labels: QanLabel[] = [
        { key: 'database', value: [database] },
        { key: 'service_name', value: [pgsmServiceName] },
      ];

      for (const row of pgsmRows) {
        const response = await api.qanApi.getMetricByFilter(
          row.pgsm_query_id,
          'queryid',
          labels,
          fromStart,
          toStart,
        );

        if (response.status !== 200 || !response.data.metrics) {
          continue;
        }

        // ClickHouse stores seconds, PGSM stores milliseconds.
        const totalExecTime = parseFloat((row.total_exec_time / 1_000).toFixed(7));
        const averageExecTime = parseFloat((row.mean_exec_time / 1_000).toFixed(7));
        const queryCount = parseInt(row.calls, 10);
        const clickhouseSum = parseFloat(response.data.metrics.query_time.sum.toFixed(7));
        const clickhouseAvg = parseFloat(response.data.metrics.query_time.avg.toFixed(7));

        expect(
          percentageDiff(totalExecTime, clickhouseSum),
          `Total Query Time should match for query ${row.query} (${row.pgsm_query_id})`,
        ).toBeLessThanOrEqual(20);
        expect(
          percentageDiff(averageExecTime, clickhouseAvg),
          `Average Query Time should match for query ${row.query} (${row.pgsm_query_id})`,
        ).toBeLessThanOrEqual(20);
        expect(
          response.data.metrics.query_time.cnt,
          `Total Query Count should match for query ${row.query} (${row.pgsm_query_id})`,
        ).toEqual(queryCount);
      }
    },
  );

  pmmTest(
    'PMM-T1261 - Verify the "Command type" filter for Postgres @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ page, queryAnalytics, urlHelper }) => {
      const commandTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

      await page.goto(urlHelper.buildUrlWithParameters(queryAnalytics.url, { from: 'now-5m' }));
      await queryAnalytics.waitForLoaded();
      await queryAnalytics.selectContainFilter(pgsmServiceName);
      await queryAnalytics.selectContainFilter(database);
      await expect(queryAnalytics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

      for (const commandType of commandTypes) {
        await pmmTest.step(`Apply Command Type filter: ${commandType}`, async () => {
          await queryAnalytics.selectFilterInGroup(commandType, 'Command Type');
          await expect(queryAnalytics.elements.queryRows.first()).toBeVisible({
            timeout: Timeouts.THIRTY_SECONDS,
          });
        });
      }
    },
  );

  pmmTest(
    'PMM-T1262 - Verify Postgresql Dashboard Instance Summary has Data @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ dashboard, page, postgresqlInstanceSummaryDashboard, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(postgresqlInstanceSummaryDashboard.url, {
          from: 'now-5m',
          serviceName: pgsmServiceName,
        }),
      );
      await dashboard.verifyMetricsPresent(postgresqlInstanceSummaryDashboard.metrics);
      await dashboard.verifyAllPanelsHaveData(postgresqlInstanceSummaryDashboard.noDataMetrics);
    },
  );

  pmmTest(
    'Verify Postgresql Dashboard Instance Summary has Data with socket based service and Agent log @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper, dashboard, page, postgresqlInstanceSummaryDashboard, urlHelper }) => {
      await page.goto(
        urlHelper.buildUrlWithParameters(postgresqlInstanceSummaryDashboard.url, {
          from: 'now-5m',
          serviceName: pgsmServiceNameSocket,
        }),
      );
      await dashboard.verifyMetricsPresent(postgresqlInstanceSummaryDashboard.metrics);
      await dashboard.verifyAllPanelsHaveData(postgresqlInstanceSummaryDashboard.noDataMetrics);

      const logLocation = cliHelper
        .execSilent(`docker exec ${containerName} find / -path /proc -prune -o -name pmm-agent.log -print`)
        .stdout.trim();
      const log = cliHelper.execSilent(`docker exec ${containerName} cat ${logLocation}`).stdout;

      expect(
        log.includes('Error opening connection to database (postgres'),
        "The log wasn't supposed to contain errors regarding connection to postgres database but it does",
      ).toBeFalsy();
    },
  );

  pmmTest(
    'PMM-T1259 - Verifying data in Clickhouse and comparing with PGSM output using pgbench @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ api, cliHelper, pgsqlHelper }) => {
      // Known discrepancy in the numbers is tracked in PMM-13544; kept as a
      // best-effort port with relaxed (25%) thresholds.
      const db = `${database}_pgbench`;

      pgsqlHelper.exec('SELECT now();', { container: containerName }).assertSuccess();
      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });

      const dbExists = pgsqlHelper.queryRows(`SELECT * FROM pg_database where datname = '${db}';`, {
        container: containerName,
      });

      if (dbExists.length === 0) {
        pgsqlHelper.exec(`Create database ${db};`, { container: containerName }).assertSuccess();
        pgsqlHelper.exec(`ALTER DATABASE ${db} owner to pmm;`, { container: containerName }).assertSuccess();
      }

      cliHelper
        .execSilent(`docker exec ${containerName} pgbench -i -s 100 --username=pmm ${db}`)
        .assertSuccess();
      cliHelper
        .execSilent(`docker exec ${containerName} pgbench -c 2 -j 2 -T 60 --username=pmm ${db}`)
        .assertSuccess();
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`,
        )
        .assertSuccess();

      await sleep(Timeouts.THIRTY_SECONDS);

      const selectColumns =
        versionNumber < 13
          ? 'query, pgsm_query_id, calls, total_time as total_exec_time, mean_time as mean_exec_time'
          : 'query, pgsm_query_id, calls, total_exec_time, mean_exec_time';
      const pgsmRows = pgsqlHelper.queryRows<{
        calls: string;
        mean_exec_time: number;
        pgsm_query_id: string;
        query: string;
        total_exec_time: number;
      }>(
        `select ${selectColumns} from pg_stat_monitor WHERE queryid IS NOT NULL AND query IS NOT NULL AND datname='${db}' and bucket_done`,
        { container: containerName },
      );

      await sleep(Timeouts.TWO_MINUTES + Timeouts.THIRTY_SECONDS);

      const now = Date.now();
      const fromStart = new Date(now - 10 * 60_000).toISOString();
      const toStart = new Date(now + 10 * 60_000).toISOString();
      const labels: QanLabel[] = [
        { key: 'database', value: [db] },
        { key: 'service_name', value: [pgsmServiceName] },
      ];

      for (const row of pgsmRows) {
        const response = await api.qanApi.getMetricByFilter(
          row.pgsm_query_id,
          'queryid',
          labels,
          fromStart,
          toStart,
        );

        if (response.status !== 200 || !response.data.metrics) {
          continue;
        }

        const totalExecTime = parseFloat((row.total_exec_time / 1_000).toFixed(7));
        const averageExecTime = parseFloat((row.mean_exec_time / 1_000).toFixed(7));
        const clickhouseSum = parseFloat(response.data.metrics.query_time.sum.toFixed(7));
        const clickhouseAvg = parseFloat(response.data.metrics.query_time.avg.toFixed(7));

        expect(percentageDiff(totalExecTime, clickhouseSum)).toBeLessThanOrEqual(25);
        expect(percentageDiff(averageExecTime, clickhouseAvg)).toBeLessThanOrEqual(25);
      }
    },
  );

  pmmTest(
    'PMM-T1063 - Verify Application Name with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper, page, pgsqlHelper, queryAnalytics, urlHelper }) => {
      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });
      pgsqlHelper.runSqlFile('testdata/pgsql/pgsm_applicationName.sql', { container: containerName });

      await sleep(Timeouts.TWO_MINUTES);
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`,
        )
        .assertSuccess();

      await page.goto(urlHelper.buildUrlWithParameters(queryAnalytics.url, { from: 'now-5m' }));
      await queryAnalytics.waitForLoaded();
      await queryAnalytics.selectFilter('PMMT1063');
      await expect(queryAnalytics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await queryAnalytics.waitForLoaded();

      const rowCount = await queryAnalytics.getRowCount();

      expect(rowCount, 'Expected only 5 queries for application name PMMT1063').toEqual(5);
    },
  );

  pmmTest(
    'PMM-T1063 - Verify Top Query and Top QueryID with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ page, pgsqlHelper, queryAnalytics, urlHelper }) => {
      const db = `${database}_topquery`;
      const queryWithTopId = '(select $1 + $2)';

      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });

      const dbExists = pgsqlHelper.queryRows(`SELECT * FROM pg_database where datname = '${db}';`, {
        container: containerName,
      });

      if (dbExists.length === 0) {
        pgsqlHelper.exec(`Create database ${db};`, { container: containerName }).assertSuccess();
      }

      pgsqlHelper.runSqlFile('testdata/pgsql/pgsm_topQuery.sql', { container: containerName, database: db });

      await sleep(Timeouts.TWO_MINUTES);

      let pgsmRows = pgsqlHelper.queryRows<{ pgsm_query_id: string; top_query: string; top_queryid: string }>(
        `select query, pgsm_query_id, top_queryid, top_query from pg_stat_monitor where datname='${db}' and query like '${queryWithTopId}' and top_query IS NOT NULL`,
        { container: containerName },
      );

      if (pgsmRows.length === 0) {
        pgsmRows = pgsqlHelper.queryRows(
          `select query, pgsm_query_id, top_queryid, top_query from pg_stat_monitor where datname='${db}' and query like '<insufficient disk/shared space' and top_query IS NOT NULL`,
          { container: containerName },
        );
      }

      for (const row of pgsmRows) {
        await page.goto(
          urlHelper.buildUrlWithParameters(queryAnalytics.url, { database: db, from: 'now-5m' }),
        );
        await queryAnalytics.waitForLoaded();
        await queryAnalytics.searchByValue(row.pgsm_query_id);
        await queryAnalytics.waitForLoaded();
        await queryAnalytics.selectRow(1);
        await queryAnalytics.waitForTopQuery();
      }
    },
  );

  pmmTest(
    'PMM-T1071 - Verify Histogram is displayed for each query with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ page, pgsqlHelper, queryAnalytics, urlHelper }) => {
      const db = `${database}_histogram`;

      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });

      const dbExists = pgsqlHelper.queryRows(`SELECT * FROM pg_database where datname = '${db}';`, {
        container: containerName,
      });

      if (dbExists.length === 0) {
        pgsqlHelper.exec(`Create database ${db};`, { container: containerName }).assertSuccess();
      }

      pgsqlHelper.runSqlFile('testdata/pgsql/pgsm_Histogram.sql', { container: containerName, database: db });

      await sleep(Timeouts.TWO_MINUTES);

      await page.goto(urlHelper.buildUrlWithParameters(queryAnalytics.url, { database: db, from: 'now-5m' }));
      await queryAnalytics.waitForLoaded();

      const rowCount = await queryAnalytics.getRowCount();
      let histogramCount = 0;

      // Skip the first (top) query generated by select pg_sleep().
      for (let row = 2; row <= rowCount; row++) {
        await queryAnalytics.selectRow(row);
        histogramCount += await queryAnalytics.countHistograms();
      }

      expect(histogramCount, 'Expected at least 5 queries to have a histogram').toBeGreaterThan(5);
    },
  );

  pmmTest(
    'PMM-T1253 - Verify pg_stat_monitor.pgsm_normalized_query settings @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper, page, pgsqlHelper, queryAnalytics, urlHelper }) => {
      const queriesNumber = 2;

      pgsqlHelper.cleanupClickhouse();
      pgsqlHelper.resetPgStatMonitor({ container: containerName });

      const checkForExamples = async (expectNoExamples: boolean) => {
        await page.goto(urlHelper.buildUrlWithParameters(queryAnalytics.url, { from: 'now-5m' }));
        await queryAnalytics.waitForLoaded();
        await queryAnalytics.selectFilter(pgsmServiceName);

        for (let i = 1; i < queriesNumber; i++) {
          const tableName = `PMM_T1253_${i}_${Math.floor(Math.random() * 10_000)}`;

          pgsqlHelper.exec(`CREATE TABLE ${tableName} ( TestId int );`, { container: containerName });
          pgsqlHelper.exec(`DROP TABLE ${tableName};`, { container: containerName });
          await queryAnalytics.searchByValue(tableName);
          await queryAnalytics.selectRow(1);
          await queryAnalytics.checkExamplesTab(expectNoExamples);
        }
      };

      pgsqlHelper
        .exec("ALTER SYSTEM SET pg_stat_monitor.pgsm_normalized_query='no';", { container: containerName })
        .assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} service postgresql restart`).assertSuccess();

      const defaultSetting = pgsqlHelper.queryRows<{ default_value: string; value: string }>(
        "SELECT * FROM pg_stat_monitor_settings WHERE name='pg_stat_monitor.pgsm_normalized_query'",
        { container: containerName },
      );

      expect(defaultSetting[0].value).toEqual('no');

      await checkForExamples(false);

      pgsqlHelper
        .exec("ALTER SYSTEM SET pg_stat_monitor.pgsm_normalized_query='yes';", { container: containerName })
        .assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} service postgresql restart`).assertSuccess();
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`,
        )
        .assertSuccess();

      const alteredSetting = pgsqlHelper.queryRows<{ value: string }>(
        "SELECT * FROM pg_stat_monitor_settings WHERE name='pg_stat_monitor.pgsm_normalized_query'",
        { container: containerName },
      );

      expect(alteredSetting[0].value).toEqual('yes');

      await checkForExamples(true);
    },
  );

  pmmTest(
    'PMM-T1292 + PMM-T1302 + PMM-T1303 + PMM-T1283 - Verify pmm-admin inventory add agent postgres-exporter with --log-level flag @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ agentHelper, api, cliHelper }) => {
      const pgServiceName = 'pgsql_pgsm_inventory_service';

      cliHelper.execSilent(
        `docker exec ${containerName} pmm-admin remove postgresql ${pgServiceName} || true`,
      );
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin add postgresql --query-source=pgstatmonitor --agent-password='testing' --password=${connection.password} --username=${connection.user} --service-name=${pgServiceName}`,
        )
        .assertSuccess();

      const service = await api.inventoryApi.getServiceDetailsByPartialName(pgServiceName);
      const pmmAgentId = cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin status | grep "Agent ID" | awk -F " " '{print $4}'`,
        )
        .stdout.trim();
      const dbDetails = {
        container: containerName,
        password: 'pmm',
        pmmAgentId,
        serviceId: service.service_id,
        serviceName: pgServiceName,
        username: 'pmm',
      };

      for (const logLevel of ['warn', 'debug', 'info', 'error'] as const) {
        await agentHelper.verifyAgentLogLevel(api.inventoryApi, 'postgres-exporter', dbDetails, logLevel);
        await agentHelper.verifyAgentLogLevel(
          api.inventoryApi,
          'qan-postgresql-pgstatmonitor-agent',
          dbDetails,
          logLevel,
        );
      }

      cliHelper
        .execSilent(`docker exec ${containerName} pmm-admin remove postgresql ${pgServiceName}`)
        .assertSuccess();
    },
  );

  pmmTest(
    'PMM-T1254 - Verify pg_stat_monitor.pgsm_bucket_time settings @not-ui-pipeline @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ cliHelper, pgsqlHelper }) => {
      const defaultValue = 60;
      const alteredValue = 61;
      const waitingMessage = 'non default bucket time value is not supported, status changed to WAITING';

      pgsqlHelper
        .exec(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${defaultValue};`, {
          container: containerName,
        })
        .assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} service postgresql restart`).assertSuccess();

      let setting = pgsqlHelper.queryRows<{ reset_val: string; setting: string }>(
        "SELECT * FROM pg_settings WHERE name='pg_stat_monitor.pgsm_bucket_time'",
        { container: containerName },
      );

      expect(setting[0].setting).toEqual(String(defaultValue));
      expect(setting[0].reset_val).toEqual(String(defaultValue));

      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`,
        )
        .assertSuccess();

      await sleep(defaultValue * Timeouts.ONE_SECOND);

      const logLocation = cliHelper
        .execSilent(`docker exec ${containerName} find / -path /proc -prune -o -name pmm-agent.log -print`)
        .stdout.trim();

      expect(
        cliHelper.execSilent(`docker exec ${containerName} tail -n100 ${logLocation}`).stdout,
      ).not.toContain(waitingMessage);

      pgsqlHelper
        .exec(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${alteredValue};`, {
          container: containerName,
        })
        .assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} service postgresql restart`).assertSuccess();

      setting = pgsqlHelper.queryRows<{ reset_val: string; setting: string }>(
        "SELECT * FROM pg_settings WHERE name='pg_stat_monitor.pgsm_bucket_time'",
        { container: containerName },
      );

      expect(setting[0].setting).toEqual(String(alteredValue));

      await sleep(alteredValue * Timeouts.ONE_SECOND);

      expect(cliHelper.execSilent(`docker exec ${containerName} tail -n100 ${logLocation}`).stdout).toContain(
        waitingMessage,
      );
      cliHelper
        .execSilent(
          `docker exec ${containerName} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Waiting"`,
        )
        .assertSuccess();

      pgsqlHelper
        .exec(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${defaultValue};`, {
          container: containerName,
        })
        .assertSuccess();
      cliHelper.execSilent(`docker exec ${containerName} service postgresql restart`).assertSuccess();
    },
  );

  pmmTest(
    'PMM-T1032 + PMM-T2021 - Verify default PG queries are shipped with PMM @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ api }) => {
      const metricNames = [
        'pg_replication_lag',
        'pg_postmaster_start_time_seconds',
        'pg_stat_user_tables_analyze_count',
        'pg_stat_activity_max_state_duration',
        'pg_statio_user_tables_heap_blks_hit',
        'pg_database_size_bytes',
      ];

      for (const metric of metricNames) {
        for (const serviceName of [pgsmServiceName, pgsmServiceNameSocket]) {
          await expect
            .poll(() => api.prometheusApi.instantQueryValue(`${metric}{service_name="${serviceName}"}`), {
              intervals: [Timeouts.ONE_SECOND],
              timeout: Timeouts.THIRTY_SECONDS,
            })
            .not.toBeUndefined();
        }
      }
    },
  );

  pmmTest(
    'PMM-T2081 - Verify disable examples for PG @pgsm-pmm-integration',
    { tag: ['@pgsm-pmm-integration'] },
    async ({ agentsPage, api, page, pgsqlHelper, queryAnalytics, remoteInstancesPage, urlHelper }) => {
      const pgServiceName = `pg_disable_examples_${Math.floor(Math.random() * 10_000)}`;

      await page.goto(remoteInstancesPage.url);
      await remoteInstancesPage.openAddPostgreSQL();
      await remoteInstancesPage.selectNode('pmm-server');
      await remoteInstancesPage.fillConnectionDetails({
        host: containerName,
        password: connection.password,
        serviceName: pgServiceName,
        username: connection.user,
      });
      await remoteInstancesPage.createRemoteInstance(pgServiceName, { disableExamples: true });

      const service = await api.inventoryApi.getServiceDetailsByPartialName(pgServiceName);
      const pgStatMonitorAgentId = service.agents.find((agent) =>
        agent.agent_type.includes('PGSTATMONITOR'),
      )?.agent_id;

      expect(pgStatMonitorAgentId, 'pg_stat_monitor agent should exist').toBeTruthy();

      await page.goto(agentsPage.url(service.service_id));
      await agentsPage.showRowDetails(pgStatMonitorAgentId as string);
      await expect(agentsPage.builders.property('query_examples_disabled=true')).toBeVisible();

      await sleep(Timeouts.ONE_MINUTE + Timeouts.THIRTY_SECONDS);

      // Generate the query whose examples must be hidden.
      pgsqlHelper.exec('SELECT pg_database_size(1);', { container: containerName });

      await page.goto(
        urlHelper.buildUrlWithParameters(queryAnalytics.url, {
          from: 'now-2m',
          serviceName: pgServiceName,
        }),
      );
      await queryAnalytics.waitForLoaded();
      await queryAnalytics.searchByValue('SELECT pg_database_size($1)');
      await queryAnalytics.waitForLoaded();
      await queryAnalytics.selectRow(1);
      await queryAnalytics.verifyNoExamples();
    },
  );
});
