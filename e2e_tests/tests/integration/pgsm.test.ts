import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const database = 'pgsm_t1260';
const topQueryDatabase = `${database}_topquery`;
const histogramDatabase = `${database}_histogram`;
const pgbenchDatabase = `${database}_pgbench`;
const defaultQuerySourceService = 'pgsm_default_query_source';
const inventoryService = 'pgsql_pgsm_inventory_service';
const disableExamplesService = 'pg_disable_examples';
const agentLog = '/var/log/pmm-agent.log';
const pgStatMonitorAgent = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT';
const defaultBucketTime = 60;
const waitingMessage = 'non default bucket time value is not supported, status changed to WAITING';
let container: string;
let pmmAdmin: string;
let serviceId: string;
let serviceName: string;
let socketServiceName: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ api, cliHelper, grafanaHelper }) => {
  container = cliHelper
    .execSilent("docker ps --filter 'name=^pdpgsql_pmm_[0-9]+_1$' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(container, 'pdpgsql docker container should exist').toMatch(/^pdpgsql_pmm_\d+_1$/);
  pmmAdmin = `docker exec ${container} pmm-admin`;
  ({ service_id: serviceId, service_name: serviceName } =
    await api.inventoryApi.getServiceDetailsByRegex('^pdpgsql_'));
  ({ service_name: socketServiceName } = await api.inventoryApi.getServiceDetailsByRegex('^socket_pdpgsql_'));
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, cliHelper, postgresqlHelper }) => {
  for (const service of [defaultQuerySourceService, inventoryService]) {
    cliHelper.removeService(container, ServiceType.postgresql, service);
  }

  postgresqlHelper.query(container, 'DROP TABLE IF EXISTS pmmt1063;');

  if (
    postgresqlHelper.getSetting(container, 'pg_stat_monitor.pgsm_bucket_time').setting !==
    String(defaultBucketTime)
  ) {
    postgresqlHelper.setPgStatMonitorBucketTime(container, defaultBucketTime);
  }

  await api.inventoryApi.removeNodesByName([disableExamplesService]);
});

pmmTest.afterAll(({ postgresqlHelper }) => {
  for (const name of [database, topQueryDatabase, histogramDatabase, pgbenchDatabase]) {
    postgresqlHelper.query(container, `DROP DATABASE IF EXISTS ${name} WITH (FORCE);`);
  }
});

pmmTest(
  'PMM-T1728 - pg_stat_monitor agent does not continuously try to create pg_stat_monitor_settings view @not-ui-pipeline @pgsm-pmm-integration',
  ({ cliHelper, postgresqlHelper }) => {
    for (const line of [
      'ERROR: +relation "pg_stat_monitor_settings" already exists',
      'STATEMENT: +CREATE VIEW pg_stat_monitor_settings AS SELECT \\* FROM pg_settings WHERE name like',
    ] as const) {
      cliHelper
        .execute(
          `docker exec ${container} grep -E '${line}' /var/log/postgresql/postgresql-${container.split('_')[2]}-main.log`,
        )
        .exitCodeEquals(1);
    }

    expect(
      postgresqlHelper.query(
        container,
        "SELECT count(*) FROM information_schema.views WHERE table_name = 'pg_stat_monitor_settings';",
      ),
      'PG should not have "pg_stat_monitor_settings" view',
    ).toBe('0');
  },
);

pmmTest(
  'PMM-T1867 - pg_stat_monitor is used by default without providing --query-source @not-ui-pipeline @pgsm-pmm-integration',
  async ({ cliHelper }) => {
    const {
      service: { service_id },
    } = JSON.parse(
      cliHelper
        .execute(
          `${pmmAdmin} add postgresql --json --password=pass+this --username=postgres --service-name=${defaultQuerySourceService}`,
        )
        .assertSuccess().stdout,
    ) as { service: { service_id: string } };

    await expect
      .poll(() => cliHelper.getPmmAdminServiceAgents(container, service_id), {
        message: 'pg_stat_monitor agent should exist and be Running',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toContainEqual(
        expect.objectContaining({
          agent_type: pgStatMonitorAgent,
          status: 'RUNNING',
        }),
      );
    expect(
      cliHelper.getPmmAdminServiceAgents(container, service_id),
      'pg_stat_statements agent should not exist',
    ).not.toContainEqual(
      expect.objectContaining({ agent_type: 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT' }),
    );
  },
);

pmmTest(
  'PMM-T1260 - Verifying data in Clickhouse and comparing with PGSM output @not-ui-pipeline @pgsm-pmm-integration',
  async ({ api, clickHouseHelper, cliHelper, postgresqlHelper }) => {
    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    postgresqlHelper.query(container, 'SELECT pg_stat_monitor_reset();');
    postgresqlHelper.createDatabaseIfMissing(container, database);
    postgresqlHelper.loadFile(container, 'testdata/pgsql/pgsm_load.sql', database);
    expect(cliHelper.getPmmAdminServiceAgents(container, serviceId)).toContainEqual(
      expect.objectContaining({
        agent_type: pgStatMonitorAgent,
        status: 'RUNNING',
      }),
    );

    const rows = postgresqlHelper.queryRows<{
      calls: number;
      mean_exec_time: number;
      pgsm_query_id: string;
      query: string;
      total_exec_time: number;
    }>(
      container,
      `SELECT min(query) AS query, pgsm_query_id::text AS pgsm_query_id, sum(calls) AS calls, sum(total_exec_time) AS total_exec_time, sum(mean_exec_time) AS mean_exec_time FROM pg_stat_monitor WHERE datname = '${database}' AND query NOT IN ('SELECT version()', 'SELECT /* pmm-agent:pgstatmonitor */ version()') AND query NOT LIKE '%current_database() datname%' GROUP BY pgsm_query_id HAVING count(*) = 1`,
    );

    expect(rows, `pg_stat_monitor should record the ${database} load`).not.toHaveLength(0);
    await expect(async () => {
      const period = {
        period_start_from: new Date(Date.now() - 10 * 60_000).toISOString(),
        period_start_to: new Date(Date.now() + 10 * 60_000).toISOString(),
      };

      for (const { calls, mean_exec_time, pgsm_query_id, query, total_exec_time } of rows) {
        const { body, status, text } = await api.qanApi.getMetrics(undefined, pgsm_query_id, period, [
          { key: 'database', value: [database] },
          { key: 'service_name', value: [serviceName] },
        ]);

        expect(status, `QAN metrics of "${query}" (${pgsm_query_id}): ${text}`).toBe(200);

        const queryTime = body.metrics?.query_time;

        expect(queryTime, `ClickHouse should store metrics for query "${query}"`).toBeDefined();

        const clickhouseSum = Number((queryTime?.sum ?? NaN).toFixed(7));
        const clickhouseAvg = Number((queryTime?.avg ?? NaN).toFixed(7));
        const pgsmTotal = Number((total_exec_time / 1_000).toFixed(7));
        const pgsmAvg = Number((mean_exec_time / 1_000).toFixed(7));

        expect(
          Math.abs(pgsmTotal - clickhouseSum),
          `Total query time of "${query}" (${pgsm_query_id}): ClickHouse ${clickhouseSum}, PGSM ${pgsmTotal}`,
        ).toBeLessThanOrEqual(0.2 * clickhouseSum);
        expect(
          Math.abs(pgsmAvg - clickhouseAvg),
          `Average query time of "${query}" (${pgsm_query_id}): ClickHouse ${clickhouseAvg}, PGSM ${pgsmAvg}`,
        ).toBeLessThanOrEqual(0.2 * clickhouseAvg);
        expect(queryTime?.cnt, `Query count of "${query}" (${pgsm_query_id})`).toBe(calls);
      }
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  },
);

pmmTest(
  'PMM-T1261 - Verify the "Command type" filter for Postgres @not-ui-pipeline @pgsm-pmm-integration',
  async ({ qanStoredMetrics }) => {
    await qanStoredMetrics.openFilteredByService(qanStoredMetrics.url, serviceName);
    await qanStoredMetrics.selectFilter(
      database,
      qanStoredMetrics.builders.filterCheckboxInGroup(database, 'Database'),
    );
    await qanStoredMetrics.waitForLoad();
    await expect(qanStoredMetrics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

    for (const [group, filter] of [
      ['Command Type', 'SELECT'],
      ['Command Type', 'INSERT'],
      ['Command Type', 'UPDATE'],
      ['Command Type', 'DELETE'],
      ['Application Name', 'pmm-codeceptjs'],
      ['Application Name', 'codeceptjs'],
      ['Database', database],
    ] as const) {
      for (let toggle = 0; toggle < 2; toggle++) {
        await qanStoredMetrics.selectFilter(
          filter,
          qanStoredMetrics.builders.filterCheckboxInGroup(filter, group),
        );
        await qanStoredMetrics.waitForLoad();
      }
    }
  },
);

pmmTest(
  'PMM-T2825 - Verify Postgresql Dashboard Instance Summary has Data with socket based service and Agent log @not-ui-pipeline @pgsm-pmm-integration',
  async ({ cliHelper, dashboard, page, urlHelper }) => {
    const summary = dashboard.postgresql.postgresqlInstanceSummary;

    await page.goto(
      urlHelper.buildUrlWithParameters(summary.url, {
        from: 'now-5m',
        serviceName: socketServiceName,
        to: 'now',
      }),
    );
    await dashboard.verifyMetricsPresent(summary.metrics);
    await dashboard.verifyAllPanelsHaveData(summary.noDataMetrics, Timeouts.FIVE_MINUTES);
    expect(
      cliHelper.execSilent(`docker exec ${container} cat ${agentLog}`).assertSuccess().stdout,
      'The log was not supposed to contain errors regarding connection to postgres database',
    ).not.toContain('Error opening connection to database (postgres');
  },
);

// eslint-disable-next-line playwright/no-skipped-test -- PMM-13544: ClickHouse and pg_stat_monitor totals diverge under pgbench load; unskip once PMM-13544 is fixed.
pmmTest.skip(
  'PMM-T1259 - Verifying data in Clickhouse and comparing with PGSM output @pgsm-pmm-integration @not-ui-pipeline',
  async ({ api, clickHouseHelper, cliHelper, postgresqlHelper }) => {
    const excludedQueries = [
      'SELECT version()',
      'SELECT /* pmm-agent:pgstatmonitor */ version()',
      'SELECT current_database() datname, schemaname, relname, heap_blks_read, heap_blks_hit, idx_blks_read, idx_blks_hit, toast_blks_read, toast_blks_hit, tidx_blks_read, tidx_blks_hit FROM pg_statio_user_tables',
      "SELECT\n  current_database() datname,\n  schemaname,\n  relname,\n  seq_scan,\n  seq_tup_read,\n  idx_scan,\n  idx_tup_fetch,\n  n_tup_ins,\n  n_tup_upd,\n  n_tup_del,\n  n_tup_hot_upd,\n  n_live_tup,\n  n_dead_tup,\n  n_mod_since_analyze,\n  COALESCE(last_vacuum, '1970-01-01Z') as last_vacuum,\n  COALESCE(last_autovacuum, '1970-01-01Z') as last_autovacuum,\n  COALESCE(last_analyze, '1970-01-01Z') as last_analyze,\n  COALESCE(last_autoanalyze, '1970-01-01Z') as last_autoanalyze,\n  vacuum_count,\n  autovacuum_count,\n  analyze_count,\n  autoanalyze_count\nFROM\n  pg_stat_user_tables",
      'END',
      'BEGIN',
      'COMMIT',
    ];

    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    postgresqlHelper.query(container, 'SELECT pg_stat_monitor_reset();');
    postgresqlHelper.createDatabaseIfMissing(container, pgbenchDatabase);
    postgresqlHelper.query(container, `ALTER DATABASE ${pgbenchDatabase} OWNER TO pmm;`);
    postgresqlHelper.pgbench(container, `-i -s 100 --username=pmm ${pgbenchDatabase}`);
    postgresqlHelper.pgbench(container, `-c 2 -j 2 -T 60 --username=pmm ${pgbenchDatabase}`);
    expect(cliHelper.getPmmAdminServiceAgents(container, serviceId)).toContainEqual(
      expect.objectContaining({
        agent_type: pgStatMonitorAgent,
        status: 'RUNNING',
      }),
    );

    const rows = postgresqlHelper
      .queryRows<{ pgsm_query_id: string; query: string }>(
        container,
        `SELECT query, pgsm_query_id::text AS pgsm_query_id FROM pg_stat_monitor WHERE queryid IS NOT NULL AND query IS NOT NULL AND datname = '${pgbenchDatabase}' AND bucket_done`,
      )
      .filter(({ query }) => !excludedQueries.includes(query));

    expect(rows, `pg_stat_monitor should record the ${pgbenchDatabase} load`).not.toHaveLength(0);
    await expect(async () => {
      const period = {
        period_start_from: new Date(Date.now() - 10 * 60_000).toISOString(),
        period_start_to: new Date(Date.now() + 10 * 60_000).toISOString(),
      };

      for (const { pgsm_query_id, query } of rows) {
        const { body, status, text } = await api.qanApi.getMetrics(undefined, pgsm_query_id, period, [
          { key: 'database', value: [pgbenchDatabase] },
          { key: 'service_name', value: [serviceName] },
        ]);

        expect(status, `QAN metrics of "${query}" (${pgsm_query_id}): ${text}`).toBe(200);

        const queryTime = body.metrics?.query_time;
        const [pgsm] = postgresqlHelper.queryRows<{ calls: number; mean: number; total: number }>(
          container,
          `SELECT sum(total_exec_time) AS total, avg(mean_exec_time) AS mean, sum(calls) AS calls FROM pg_stat_monitor WHERE datname = '${pgbenchDatabase}' AND pgsm_query_id = ${pgsm_query_id}`,
        );

        expect(queryTime, `ClickHouse should store metrics for query "${query}"`).toBeDefined();

        const clickhouseSum = Number((queryTime?.sum ?? NaN).toFixed(7));
        const clickhouseAvg = Number((queryTime?.avg ?? NaN).toFixed(7));
        const pgsmTotal = Number((pgsm.total / 1_000).toFixed(7));
        const pgsmAvg = Number((pgsm.mean / 1_000).toFixed(7));

        expect(
          Math.abs(pgsmTotal - clickhouseSum),
          `Total query time of "${query}" (${pgsm_query_id}): ClickHouse ${clickhouseSum}, PGSM ${pgsmTotal}`,
        ).toBeLessThanOrEqual(0.25 * clickhouseSum);
        expect(
          Math.abs(pgsmAvg - clickhouseAvg),
          `Average query time of "${query}" (${pgsm_query_id}): ClickHouse ${clickhouseAvg}, PGSM ${pgsmAvg}`,
        ).toBeLessThanOrEqual(0.25 * clickhouseAvg);
        expect(queryTime?.cnt, `Query count of "${query}" (${pgsm_query_id})`).toBe(pgsm.calls);
      }
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  },
);

pmmTest(
  'PMM-T1063 - Verify Application Name with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ clickHouseHelper, cliHelper, page, postgresqlHelper, qanStoredMetrics, urlHelper }) => {
    const applicationName = 'PMMT1063';

    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    postgresqlHelper.query(container, 'SELECT pg_stat_monitor_reset();');
    postgresqlHelper.loadFile(container, 'testdata/pgsql/pgsm_applicationName.sql');

    await expect(async () => {
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectFilter(
        applicationName,
        qanStoredMetrics.builders.filterCheckboxInGroup(applicationName, 'Application Name'),
      );
      await expect(qanStoredMetrics.buttons.showSelected).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await qanStoredMetrics.waitForLoad();
      await expect(
        qanStoredMetrics.elements.workloadRows,
        `Only the 4 statements after SET application_name should show up for ${applicationName}`,
      ).toHaveCount(4);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    expect(cliHelper.getPmmAdminServiceAgents(container, serviceId)).toContainEqual(
      expect.objectContaining({
        agent_type: pgStatMonitorAgent,
        status: 'RUNNING',
      }),
    );
  },
);

pmmTest(
  'PMM-T1063 - Verify Top Query and Top QueryID with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ clickHouseHelper, page, postgresqlHelper, qanStoredMetrics, urlHelper }) => {
    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    postgresqlHelper.query(container, 'SELECT pg_stat_monitor_reset();');
    postgresqlHelper.createDatabaseIfMissing(container, topQueryDatabase);
    postgresqlHelper.loadFile(container, 'testdata/pgsql/pgsm_topQuery.sql', topQueryDatabase);

    const rows = postgresqlHelper.queryRows<{ pgsm_query_id: string }>(
      container,
      `WITH top AS (SELECT pgsm_query_id::text AS pgsm_query_id, query FROM pg_stat_monitor WHERE datname = '${topQueryDatabase}' AND top_query IS NOT NULL) SELECT pgsm_query_id FROM top WHERE query LIKE '(select $1 + $2)' OR (query LIKE '<insufficient disk/shared space' AND NOT EXISTS (SELECT 1 FROM top WHERE query LIKE '(select $1 + $2)'))`,
    );

    expect(rows, 'pg_stat_monitor should record a top query for (select $1 + $2)').not.toHaveLength(0);

    for (const { pgsm_query_id } of rows) {
      await expect(async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
            database: topQueryDatabase,
            from: 'now-5m',
            to: 'now',
          }),
        );
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.searchByValue(pgsm_query_id);
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.selectRow(1);
        await expect(qanStoredMetrics.elements.topQuery).toBeVisible({ timeout: Timeouts.FIVE_SECONDS });
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    }
  },
);

pmmTest(
  'PMM-T1071 - Verify Histogram is displayed for each query with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ clickHouseHelper, page, postgresqlHelper, qanStoredMetrics, urlHelper }) => {
    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    postgresqlHelper.query(container, 'SELECT pg_stat_monitor_reset();');
    postgresqlHelper.createDatabaseIfMissing(container, histogramDatabase);
    postgresqlHelper.loadFile(container, 'testdata/pgsql/pgsm_Histogram.sql', histogramDatabase);

    await expect(async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          database: histogramDatabase,
          from: 'now-5m',
          to: 'now',
        }),
      );
      await qanStoredMetrics.waitForLoad();
      await expect(qanStoredMetrics.elements.workloadRows.first()).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      expect(
        await qanStoredMetrics.countHistograms(2),
        'Expected at least 5 queries to have Histogram in query details',
      ).toBeGreaterThan(5);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
  },
);

pmmTest(
  'PMM-T1292 + PMM-T1302 + PMM-T1303 + PMM-T1283 - Verify that pmm-admin inventory add agent postgres-exporter with --log-level flag adds PostgreSQL exporter with corresponding log-level @not-ui-pipeline @pgsm-pmm-integration',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(
        `${pmmAdmin} add postgresql --query-source=pgstatmonitor --agent-password='testing' --password=pass+this --username=postgres --service-name=${inventoryService}`,
      )
      .assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.postgresql,
      inventoryService,
    );
    const pmmAgentId = cliHelper.getPmmAdminStatusField(container, 'Agent ID');

    for (const logLevel of ['warn', 'debug', 'info', 'error'] as const) {
      for (const agentType of ['postgres-exporter', 'qan-postgresql-pgstatmonitor-agent'] as const) {
        const agentId = cliHelper.getPmmAdminField(
          cliHelper
            .execute(
              `${pmmAdmin} inventory add agent ${agentType} --password=pmm --log-level=${logLevel} ${pmmAgentId} ${service_id} pmm`,
            )
            .assertSuccess().stdout,
          'Agent ID',
        );

        await expect
          .poll(
            async () =>
              (await api.inventoryApi.getAgents())[agentType.replaceAll('-', '_')]?.find(
                (agent) => agent.agent_id === agentId,
              ),
            {
              message: `${agentType} added with --log-level=${logLevel}`,
              timeout: Timeouts.THIRTY_SECONDS,
            },
          )
          .toMatchObject({ log_level: `LOG_LEVEL_${logLevel.toUpperCase()}`, status: AgentStatus.running });
        cliHelper.execute(`${pmmAdmin} inventory remove agent ${agentId}`).assertSuccess();
      }
    }
  },
);

pmmTest(
  'PMM-T1254 - Verify pg_stat_monitor.pgsm_bucket_time settings @not-ui-pipeline @pgsm-pmm-integration',
  async ({ cliHelper, page, postgresqlHelper }) => {
    const alteredBucketTime = 61;
    const bucketTime = 'pg_stat_monitor.pgsm_bucket_time';

    postgresqlHelper.setPgStatMonitorBucketTime(container, defaultBucketTime);
    expect(postgresqlHelper.getSetting(container, bucketTime)).toEqual({
      reset_val: String(defaultBucketTime),
      setting: String(defaultBucketTime),
    });
    cliHelper.execute(`docker exec ${container} truncate -s 0 ${agentLog}`).assertSuccess();
    await expect
      .poll(() => cliHelper.getPmmAdminServiceAgents(container, serviceId), {
        message: 'pg_stat_monitor agent should be Running after the restart',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toContainEqual(expect.objectContaining({ agent_type: pgStatMonitorAgent, status: 'RUNNING' }));
    // eslint-disable-next-line playwright/no-wait-for-timeout -- one default bucket for the agent to log a WAITING status it must not log
    await page.waitForTimeout(Timeouts.ONE_MINUTE);
    expect(
      cliHelper.tailContainerFile(container, agentLog),
      'The log was not supposed to contain errors regarding bucket time',
    ).not.toContain(waitingMessage);

    postgresqlHelper.setPgStatMonitorBucketTime(container, alteredBucketTime);
    expect(postgresqlHelper.getSetting(container, bucketTime).setting).toBe(String(alteredBucketTime));
    await expect(() => {
      expect(
        cliHelper.tailContainerFile(container, agentLog),
        'The log was supposed to contain errors regarding bucket time',
      ).toContain(waitingMessage);
      expect(cliHelper.getPmmAdminServiceAgents(container, serviceId)).toContainEqual(
        expect.objectContaining({ agent_type: pgStatMonitorAgent, status: 'WAITING' }),
      );
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
  },
);

pmmTest(
  'PMM-T1032 + PMM-T2021 - Verify default PG queries are shipped with PMM @pgsm-pmm-integration',
  async ({ api }) => {
    for (const metric of [
      'pg_replication_lag',
      'pg_postmaster_start_time_seconds',
      'pg_stat_user_tables_analyze_count',
      'pg_stat_activity_max_state_duration',
      'pg_statio_user_tables_heap_blks_hit',
      'pg_database_size_bytes',
    ] as const) {
      for (const service of [serviceName, socketServiceName]) {
        await api.grafanaApi.waitForMetric(`${metric}{service_name="${service}"}`, Timeouts.THIRTY_SECONDS);
      }
    }
  },
);

pmmTest(
  'PMM-T2081 - Verify disable examples for PG @pgsm-pmm-integration',
  async ({ addInstancePage, agentsPage, api, page, qanStoredMetrics, servicesPage, urlHelper }) => {
    await pmmTest.step(
      'Add the pdpgsql node as a remote PostgreSQL instance with query examples disabled',
      async () => {
        await page.goto(addInstancePage.url);
        await addInstancePage.fillRemoteDatabase('postgresql', 'pmm-server', {
          host: container,
          password: 'pass+this',
          serviceName: disableExamplesService,
          username: 'postgres',
        });
        await addInstancePage.buttons.skipTlsVerify.check({ timeout: Timeouts.THIRTY_SECONDS });
        await addInstancePage.buttons.disableQueryExamples.click();
        expect((await addInstancePage.addService()).status()).toEqual(200);
      },
    );

    await expect(servicesPage.builders.serviceRow(disableExamplesService)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.postgresql,
      disableExamplesService,
    );

    await page.goto(agentsPage.serviceAgentsUrl(service_id));
    await agentsPage.verifyAgentDetailsLabel(
      'QAN PostgreSQL pg_stat_monitor agent',
      'query_examples_disabled=true',
    );
    await expect(async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          from: 'now-2m',
          serviceName: disableExamplesService,
          to: 'now',
        }),
      );
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.searchByValue('SELECT pg_database_size($1)');
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectRow(1);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.openDetailsTab('Examples');
    await expect(qanStoredMetrics.elements.noExamples).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);
