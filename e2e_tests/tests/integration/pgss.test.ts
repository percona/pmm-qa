import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { AgentStatus, ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const database = 'pgss_t1312';
const fallbackService = 'pgss_default_query_source';
const inventoryService = 'pgsql_pgss_inventory_service';
const pgssMax = 5_000;
let container: string;
let pmmAdmin: string;
let addPostgresql: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ cliHelper, grafanaHelper }) => {
  container = cliHelper
    .execSilent("docker ps --filter 'name=^pgsql_pgss_pmm_' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(container, 'pgsql_pgss_pmm docker container should exist').toMatch(/^pgsql_pgss_pmm_/);
  pmmAdmin = `docker exec ${container} pmm-admin`;
  addPostgresql = `${pmmAdmin} add postgresql --password=pass+this --username=postgres`;
  await grafanaHelper.authorize();
});

pmmTest.afterEach(({ cliHelper }) => {
  for (const service of [fallbackService, inventoryService]) {
    cliHelper.removeService(container, ServiceType.postgresql, service);
  }

  cliHelper.queryPostgresql(container, `DROP DATABASE IF EXISTS ${database} WITH (FORCE);`);

  if (cliHelper.queryPostgresql(container, 'SHOW pg_stat_statements.max;') !== String(pgssMax)) {
    cliHelper.setPgStatStatementsMax(container, pgssMax);
  }
});

pmmTest(
  'PMM-T1868 - pg_stat_statements is used if no --query-source flag provided and pg_stat_monitor is not configured @not-ui-pipeline @pgss-pmm-integration',
  async ({ cliHelper }) => {
    const {
      service: { service_id },
      warning,
    } = JSON.parse(
      cliHelper.execute(`${addPostgresql} --json --service-name=${fallbackService}`).assertSuccess().stdout,
    ) as { service: { service_id: string }; warning: string };

    expect(warning, 'pmm-admin should warn that it falls back to pg_stat_statements').toBe(
      'Could not to detect the pg_stat_monitor extension on your system. Falling back to the pg_stat_statements.',
    );
    await expect
      .poll(() => cliHelper.getPmmAdminServiceAgents(container, service_id), {
        message: 'pg_stat_statements agent should exist and be Running',
        timeout: Timeouts.THIRTY_SECONDS,
      })
      .toContainEqual(
        expect.objectContaining({
          agent_type: 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT',
          status: 'RUNNING',
        }),
      );
    expect(
      cliHelper.getPmmAdminServiceAgents(container, service_id),
      'pg_stat_monitor agent should not exist',
    ).not.toContainEqual(
      expect.objectContaining({ agent_type: 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT' }),
    );
  },
);

pmmTest(
  'PMM-T1312 - Adding Load to Postgres test database and verifying PMM-Agent and PG_STATEMENTS QAN agent is in running status @not-ui-pipeline @pgss-pmm-integration',
  async ({ clickHouseHelper, cliHelper }) => {
    cliHelper.queryPostgresql(container, `CREATE DATABASE ${database};`);
    cliHelper.queryPostgresql(container, `ALTER DATABASE ${database} OWNER TO pmm;`);
    cliHelper
      .execute(
        `docker exec -i ${container} psql -U postgres -d ${database} -v ON_ERROR_STOP=1 < testdata/pgsql/pgss_load.sql`,
      )
      .assertSuccess();

    await expect
      .poll(() => clickHouseHelper.countQanRowsWhere('pmm-server', `database = '${database}'`), {
        message: `pmm-agent should push the ${database} load to ClickHouse`,
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeGreaterThan(0);
    cliHelper.execute(`${pmmAdmin} list | grep postgresql_pgstatements_agent | grep Running`).assertSuccess();
  },
);

pmmTest(
  'PMM-T2037 - Verify QPS after changing pg_statements.max value @not-ui-pipeline @pgss-pmm-integration',
  async ({ api, clickHouseHelper, cliHelper, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pgsql_pgss_pmm_\\d');
    const queryCount = qanStoredMetrics.builders.queryValue(0, 2);

    clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
    cliHelper.queryPostgresql(container, 'ALTER SYSTEM SET max_locks_per_transaction = 1024;');

    for (const max of [20_000, pgssMax]) {
      cliHelper.setPgStatStatementsMax(container, max);
      cliHelper
        .execute(
          `docker exec -i ${container} psql -U postgres -v ON_ERROR_STOP=1 < testdata/pgsql/pgss_pmm_t2037.sql`,
        )
        .assertSuccess();
    }

    const loadedAt = Math.floor(Date.now() / 1_000);

    await expect
      .poll(
        () =>
          clickHouseHelper.countQanRowsWhere(
            'pmm-server',
            `service_name = '${service_name}' AND period_start >= toDateTime(${loadedAt})`,
          ),
        {
          message: `pmm-agent should push a ${service_name} bucket collected after the load`,
          timeout: Timeouts.FIVE_MINUTES,
        },
      )
      .toBeGreaterThan(0);
    await qanStoredMetrics.openFilteredByService(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }),
      service_name,
    );
    await expect(queryCount).toHaveText(/\d.*qps/i, { timeout: Timeouts.THIRTY_SECONDS });
    await expect(queryCount, 'TOTAL QPS value should not be in millions').not.toHaveText(/[\d.]+m\s*qps/i);
  },
);

pmmTest(
  'PMM-T1301 + PMM-T1300 - Verify that pmm-admin inventory add agent qan-postgresql-pgstatements-agent with --log-level flag adds QAN PostgreSQL PgStatements Agent with corresponding log-level @not-ui-pipeline @pgss-pmm-integration',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(
        `${addPostgresql} --query-source=pgstatements --agent-password='testing' --service-name=${inventoryService}`,
      )
      .assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.postgresql,
      inventoryService,
    );
    const pmmAgentId = cliHelper.getPmmAdminStatusField(container, 'Agent ID');

    for (const logLevel of ['warn', 'debug', 'info', 'error'] as const) {
      const agentId = cliHelper.getPmmAdminField(
        cliHelper
          .execute(
            `${pmmAdmin} inventory add agent qan-postgresql-pgstatements-agent --password=pmm --log-level=${logLevel} ${pmmAgentId} ${service_id} pmm`,
          )
          .assertSuccess().stdout,
        'Agent ID',
      );

      await expect
        .poll(
          async () =>
            (await api.inventoryApi.getAgents()).qan_postgresql_pgstatements_agent?.find(
              (agent) => agent.agent_id === agentId,
            ),
          {
            message: `qan-postgresql-pgstatements-agent added with --log-level=${logLevel}`,
            timeout: Timeouts.THIRTY_SECONDS,
          },
        )
        .toMatchObject({ log_level: `LOG_LEVEL_${logLevel.toUpperCase()}`, status: AgentStatus.running });
      cliHelper.execute(`${pmmAdmin} inventory remove agent ${agentId}`).assertSuccess();
    }
  },
);
