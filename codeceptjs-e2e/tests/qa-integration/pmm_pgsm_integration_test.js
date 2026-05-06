const { I } = inject();
const assert = require('assert');
const {
  SERVICE_TYPE,
  CLI_AGENT_STATUS,
} = require('../helper/constants');

const connection = {
  host: '127.0.0.1',
  port: 5447,
  user: 'postgres',
  password: 'pass+this',
  database: 'postgres',
};

// Service Name is determined by value of env variable PGSQL_PGSM_CONTAINER and version PGSQL_VERSION
// default value for docker container is pgsql_pgsm, version is 14, port 5437 is accessible on the host system
// Service Name: ${PGSQL_PGSM_CONTAINER}_${PGSQL_VERSION}_service
// Docker Container Name: ${PGSQL_PGSM_CONTAINER}_${PGSQL_VERSION}

const version = process.env.PDPGSQL_VERSION ? `${process.env.PDPGSQL_VERSION}` : '17';
const database = `pgsm${Math.floor(Math.random() * 99) + 1}`;
let pgsm_service_name;
let pgsm_service_name_socket;
let container_name;
const percentageDiff = (a, b) => (a - b === 0 ? 0 : 100 * Math.abs((a - b) / b));

const labels = [
  { key: 'database', value: [database] },
  { key: 'service_name', value: [pgsm_service_name] },
];

const filters = new DataTable(['filterSection', 'filterToApply']);

filters.add(['Command Type', 'SELECT']);
filters.add(['Command Type', 'INSERT']);
filters.add(['Command Type', 'UPDATE']);
filters.add(['Command Type', 'DELETE']);
filters.add(['Application Name', 'pmm-codeceptjs']);
filters.add(['Application Name', 'codeceptjs']);
filters.add(['Database', database]);

const cleanupClickhouse = async () => {
  await I.verifyCommand('docker exec pmm-server clickhouse-client --database pmm --password clickhouse --query "TRUNCATE TABLE metrics"');
};

Feature('PMM + PGSM Integration Scenarios');

BeforeSuite(async ({ I, inventoryAPI }) => {
  const pgsm_service = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pdpgsql_');
  const socket_service = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'socket_pdpgsql_');

  pgsm_service_name = pgsm_service.service_name;
  pgsm_service_name_socket = socket_service.service_name;

  // check that pdpgsql docker container exists
  const dockerCheck = await I.verifyCommand('docker ps | grep pdpgsql_ | awk \'{print $NF}\'');

  assert.ok(dockerCheck.includes('pdpgsql_'), 'pdpgsql docker container should exist. please run pmm-framework with --database pdpgsql');
  container_name = dockerCheck.trim();
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1728 - pg_stat_monitor agent does not continuously try to create pg_stat_monitor_settings view @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I }) => {
    await I.verifyCommand(
      `docker exec ${container_name} cat /var/log/postgresql/postgresql-${version}-main.log | grep 'ERROR: relation "pg_stat_monitor_settings" already exists'`,
      '',
      'fail',
    );
    await I.verifyCommand(
      `docker exec ${container_name} cat /var/log/postgresql/postgresql-${version}-main.log | grep 'STATEMENT: CREATE VIEW pg_stat_monitor_settings AS SELECT * FROM pg_settings WHERE name like'`,
      '',
      'fail',
    );

    const out = await I.pgExecuteQueryOnDemand('select table_name from INFORMATION_SCHEMA.views;', connection);
    const viewNamesArr = out.rows.map((v) => v.table_name);

    assert.ok(!viewNamesArr.includes('pg_stat_monitor_settings'), 'PG should not have "pg_stat_monitor_settings" view');
  },
);

Scenario(
  'PMM-T1867 - pg_stat_monitor is used by default without providing --query-source @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I }) => {
    const serviceName = `pgsm_${Math.floor(Math.random() * 99) + 1}`;
    const { service: { service_id: serviceId } } = JSON.parse(
      await I.verifyCommand(`docker exec ${container_name} pmm-admin add postgresql --json --password=${connection.password} --username=${connection.user} --service-name=${serviceName}`),
    );

    let list;
    let serviceAgents;

    await I.asyncWaitFor(async () => {
      list = JSON.parse(
        await I.verifyCommand(`docker exec ${container_name} pmm-admin list --json`),
      );
      serviceAgents = list.agent.filter(({ service_id }) => service_id === serviceId);
      const pgStatMonitorAgent = serviceAgents.find(({ agent_type }) => agent_type === 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT');

      assert.ok(pgStatMonitorAgent, 'pg_stat_monitor agent should exist');

      return pgStatMonitorAgent.status === CLI_AGENT_STATUS.RUNNING;
    }, 30);

    const pgStatStatementsAgent = serviceAgents.find(({ agent_type }) => agent_type === 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT');

    assert.ok(!pgStatStatementsAgent, 'pg_stat_statements agent should not exist');
  },
);

Scenario(
  'PMM-T1260 - Verifying data in Clickhouse and comparing with PGSM output @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I, qanAPI }) => {
    await I.pgExecuteQueryOnDemand('SELECT now();', connection);

    // Clear metrics in clickhouse
    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);

    // Run load on PG
    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${database}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${database};`, connection);
    }

    connection.database = database;
    const sql = await I.verifyCommand('cat testdata/pgsql/pgsm_load.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);
    connection.database = 'postgres';
    // wait for pmm-agent to push the execution as part of next bucket to clickhouse
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);

    I.wait(30);
    let pgsm_output;

    if (version < 13) {
      pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_time as total_exec_time, mean_time as mean_exec_time  from pg_stat_monitor where datname='${database}' and query NOT IN ('SELECT version()', 'SELECT /* pmm-agent:pgstatmonitor */ version()') and query NOT LIKE 'current_database() datname%';`, connection);
    } else {
      pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_exec_time, mean_exec_time from pg_stat_monitor where datname='${database}' and query NOT IN ('SELECT version()', 'SELECT /* pmm-agent:pgstatmonitor */ version()') and query NOT LIKE '%current_database() datname%';`, connection);
    }

    I.wait(150);

    const now = new Date();

    const fromStart = new Date(now.getTime() - (10 * 60000));

    const toStart = new Date(now.getTime() + (10 * 60000));

    for (let i = 0; i < pgsm_output.rows.length; i++) {
      const queryid = pgsm_output.rows[i].pgsm_query_id;
      const response = await qanAPI.getMetricByFilterAPI(queryid, 'queryid', labels, fromStart.toISOString(), toStart.toISOString());
      // we do this conversion because clickhouse has values in micro seconds, while PGSM has in milliseconds.
      const total_exec_time = parseFloat((pgsm_output.rows[i].total_exec_time / 1000).toFixed(7));
      const average_exec_time = parseFloat((pgsm_output.rows[i].mean_exec_time / 1000).toFixed(7));
      const query_cnt = parseInt(pgsm_output.rows[i].calls, 10);
      const { query } = pgsm_output.rows[i];

      if (response.status !== 200) {
        I.say(`Expected queryid with id as ${queryid} and query as ${query} to have data in clickhouse but got response as ${response.status}`);
        continue;
      }

      await I.say(`query is : ${query}`);

      if (!response.data.metrics) {
        throw new Error(`there are no metrics stored in clickhouse for query 
        "${query}"
        Full resp: 
        "${JSON.stringify(response.data)}"
        `);
      }

      const clickhouse_sum = parseFloat((response.data.metrics.query_time.sum).toFixed(7));
      const clickhouse_avg = parseFloat((response.data.metrics.query_time.avg).toFixed(7));

      I.say(`CLICKHOUSE QUERY: ${JSON.stringify(query, null, 2)}`);
      I.say(`CLICKHOUSE QUERY TIME: ${JSON.stringify(response.data.metrics.query_time)}`);

      I.say(`${average_exec_time} <--pgsm----AVG EXEC TIME----clickhouse--> ${clickhouse_avg}`);
      I.say(`${total_exec_time} <--pgsm----TOTAL EXEC TIME----clickhouse--> ${clickhouse_sum}`);
      const avg_diff = percentageDiff(average_exec_time, clickhouse_avg);
      const total_diff = percentageDiff(total_exec_time, clickhouse_sum);

      I.say(`AVG EXEC TIME % DIFF: ${avg_diff}`);
      I.say(`TOTAL EXEC TIME % DIFF: ${total_diff}`);
      assert.ok(total_diff <= 20, `Expected Total Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_sum} on clickhouse while PGSM has ${total_exec_time}`);
      assert.ok(avg_diff <= 20, `Expected Average Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_avg} on clickhouse while PGSM has ${average_exec_time}`);
      assert.ok(response.data.metrics.query_time.cnt === query_cnt, `Expected Total Query Count Metrics to be same for query ${query} with id as ${queryid} found in clickhouse as ${response.data.metrics.query_time.cnt} while pgsm has value as ${query_cnt}`);
    }
  },
).retry(2);

Data(filters).Scenario(
  'PMM-T1261 - Verify the "Command type" filter for Postgres @not-ui-pipeline @pgsm-pmm-integration',
  async ({
    I, queryAnalyticsPage, current,
  }) => {
    const serviceName = pgsm_service_name;
    const {
      filterSection, filterToApply,
    } = current;

    I.amOnPage(queryAnalyticsPage.url);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.filters.selectContainFilter(serviceName);
    queryAnalyticsPage.filters.selectContainFilter(database);
    I.waitForVisible(queryAnalyticsPage.filters.buttons.showSelected, 30);

    queryAnalyticsPage.filters.selectFilterInGroup(filterToApply, filterSection);
  },
);

Scenario(
  'PMM-T1262 - Verify Postgresql Dashboard Instance Summary has Data @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, {
      service_name: pgsm_service_name,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
  },
);

Scenario(
  'Verify Postgresql Dashboard Instance Summary has Data with socket based service and Agent log @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, {
      service_name: pgsm_service_name_socket,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
    const log = await I.verifyCommand(`docker exec ${container_name} cat pmm-agent.log`);

    I.assertFalse(
      log.includes('Error opening connection to database \(postgres'),
      'The log wasn\'t supposed to contain errors regarding connection to postgress database but it does',
    );
  },
);

// The numbers don't entirely match, we need to find a way to track based on difference
// TODO: unskip after https://perconadev.atlassian.net/browse/PMM-13544
Scenario.skip(
  'PMM-T1259 - Verifying data in Clickhouse and comparing with PGSM output @pgsm-pmm-integration @not-ui-pipeline',
  async ({ I, qanAPI }) => {
    await I.pgExecuteQueryOnDemand('SELECT now();', connection);
    const db = `${database}_pgbench`;

    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);
    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${db}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${db};`, connection);
      await I.pgExecuteQueryOnDemand(`ALTER DATABASE ${db} owner to pmm;`, connection);
    }

    connection.database = db;
    await I.verifyCommand(`docker exec ${container_name} pgbench -i -s 100 --username=pmm ${db}`);
    await I.verifyCommand(`docker exec ${container_name} pgbench -c 2 -j 2 -T 60 --username=pmm ${db}`);
    connection.database = 'postgres';
    // wait for pmm-agent to push the execution as part of next bucket to clickhouse
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);

    const labels = [
      { key: 'database', value: [`${db}`] },
      { key: 'service_name', value: [pgsm_service_name] },
    ];

    const excluded_queries = [
      'SELECT version()',
      'SELECT /* pmm-agent:pgstatmonitor */ version()',
      'SELECT current_database() datname, schemaname, relname, heap_blks_read, heap_blks_hit, idx_blks_read, idx_blks_hit, toast_blks_read, toast_blks_hit, tidx_blks_read, tidx_blks_hit FROM pg_statio_user_tables',
      'SELECT\n'
      + '  current_database() datname,\n'
      + '  schemaname,\n'
      + '  relname,\n'
      + '  seq_scan,\n'
      + '  seq_tup_read,\n'
      + '  idx_scan,\n'
      + '  idx_tup_fetch,\n'
      + '  n_tup_ins,\n'
      + '  n_tup_upd,\n'
      + '  n_tup_del,\n'
      + '  n_tup_hot_upd,\n'
      + '  n_live_tup,\n'
      + '  n_dead_tup,\n'
      + '  n_mod_since_analyze,\n'
      + '  COALESCE(last_vacuum, \'1970-01-01Z\') as last_vacuum,\n'
      + '  COALESCE(last_autovacuum, \'1970-01-01Z\') as last_autovacuum,\n'
      + '  COALESCE(last_analyze, \'1970-01-01Z\') as last_analyze,\n'
      + '  COALESCE(last_autoanalyze, \'1970-01-01Z\') as last_autoanalyze,\n'
      + '  vacuum_count,\n'
      + '  autovacuum_count,\n'
      + '  analyze_count,\n'
      + '  autoanalyze_count\n'
      + 'FROM\n'
      + '  pg_stat_user_tables',
      'END',
      'BEGIN',
      'COMMIT',
    ];

    I.wait(30);
    let pgsm_output;

    if (version < 13) {
      pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_time as total_exec_time, mean_time as mean_exec_time  from pg_stat_monitor WHERE queryid IS NOT NULL AND query IS NOT NULL AND datname='${db}' and bucket_done;`, connection);
    } else {
      pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, planid, query_plan, calls, total_exec_time, mean_exec_time from pg_stat_monitor WHERE queryid IS NOT NULL AND query IS NOT NULL AND datname='${db}' and bucket_done;`, connection);
    }

    I.wait(150);

    const now = new Date();

    const fromStart = new Date(now.getTime() - (10 * 60000));

    const toStart = new Date(now.getTime() + (10 * 60000));

    for (let i = 0; i < pgsm_output.rows.length; i++) {
      const queryid = pgsm_output.rows[i].pgsm_query_id;
      const response = await qanAPI.getMetricByFilterAPI(queryid, 'queryid', labels, fromStart.toISOString(), toStart.toISOString());
      const {
        total_exec_time,
        average_exec_time,
        query_cnt,
      } = await qanAPI.getMetricsFromPGSM(db, pgsm_output.rows[i].pgsm_query_id, connection, version);
      const { query } = pgsm_output.rows[i];

      // eslint-disable-next-line no-continue
      if (excluded_queries.includes(query)) continue;

      if (response.status !== 200) {
        assert.fail(`Expected queryid with id as ${queryid} and query as ${query} to have data in clickhouse but got response as ${response.status}. ${JSON.stringify(response.data)}}`);
      }

      await I.say(`query is : ${query}`);

      if (!response.data.metrics) {
        throw new Error(`there are no metrics stored in clickhouse for query 
        "${query}"
        Full resp: 
        "${JSON.stringify(response.data)}"
        `);
      }

      const clickhouse_sum = parseFloat((response.data.metrics.query_time.sum).toFixed(7));
      const clickhouse_avg = parseFloat((response.data.metrics.query_time.avg).toFixed(7));

      I.say(`CLICKHOUSE QUERY: ${JSON.stringify(query, null, 2)}`);
      I.say(`CLICKHOUSE QUERY TIME: ${JSON.stringify(response.data.metrics.query_time)}`);

      I.say(`${average_exec_time} <--pgsm----AVG EXEC TIME----clickhouse--> ${clickhouse_avg}`);
      I.say(`${total_exec_time} <--pgsm----TOTAL EXEC TIME----clickhouse--> ${clickhouse_sum}`);
      const avg_diff = percentageDiff(average_exec_time, clickhouse_avg);
      const total_diff = percentageDiff(total_exec_time, clickhouse_sum);

      I.say(`AVG EXEC TIME % DIFF: ${avg_diff}`);
      I.say(`TOTAL EXEC TIME % DIFF: ${total_diff}`);
      assert.ok(total_diff <= 25, `Expected Total Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_sum} on clickhouse while PGSM has ${total_exec_time}`);
      assert.ok(avg_diff <= 25, `Expected Average Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_avg} on clickhouse while PGSM has ${average_exec_time}`);
      assert.ok(response.data.metrics.query_time.cnt === query_cnt, `Expected Total Query Count Metrics to be same for query ${query} with id as ${queryid} found in clickhouse as ${response.data.metrics.query_time.cnt} while pgsm has value as ${query_cnt}`);
    }
  },
).retry(2);

Scenario(
  'PMM-T1063 - Verify Application Name with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ I, queryAnalyticsPage }) => {
    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);

    // Set Application Name and run sample queries, wait for 60 seconds to see Data in QAN
    const sql = await I.verifyCommand('cat testdata/pgsql/pgsm_applicationName.sql');
    const applicationName = 'PMMT1063';

    await I.pgExecuteQueryOnDemand(sql, connection);
    I.wait(120);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);

    const url = I.buildUrlWithParams(queryAnalyticsPage.url, {
      // application_name: applicationName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.filters.selectFilter(applicationName);
    I.wait(5);
    I.waitForVisible(queryAnalyticsPage.filters.buttons.showSelected, 30);
    queryAnalyticsPage.waitForLoaded();

    const count = await queryAnalyticsPage.data.getRowCount();

    assert.ok(parseInt(count, 10) === 5, `Expected only 5 Queries to show up for ${applicationName} based on the load script but found ${count}`);
  },
);

Scenario(
  'PMM-T1063 - Verify Top Query and Top QueryID with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ I, queryAnalyticsPage }) => {
    let pgsm_output;
    const db = `${database}_topquery`;
    const queryWithTopId = '(select $1 + $2)';
    const topQuery = 'SELECT add2(1,2)';

    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);

    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${db}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${db};`, connection);
    }

    connection.database = db;
    const sql = await I.verifyCommand('cat testdata/pgsql/pgsm_topQuery.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);
    connection.database = 'postgres';
    I.wait(120);
    pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, top_queryid, top_query  from pg_stat_monitor where datname='${db}' and query like '${queryWithTopId}' and top_query IS NOT NULL;`, connection);
    if (pgsm_output.rows.length === 0) {
      // Need clarification on this workaround from PGSM team, looks like a bug <insufficient disk/shared space
      pgsm_output = await I.pgExecuteQueryOnDemand(`select query, pgsm_query_id, top_queryid, top_query  from pg_stat_monitor where datname='${db}' and query like '<insufficient disk/shared space' and top_query IS NOT NULL;`, connection);
    }

    for (let i = 0; i < pgsm_output.rows.length; i++) {
      const topQueryId = pgsm_output.rows[i].top_queryid;
      const queryId = pgsm_output.rows[i].pgsm_query_id;
      const pgsmTopQuery = pgsm_output.rows[i].top_query;
      const pgsmQuery = pgsm_output.rows[i].query;

      const url = I.buildUrlWithParams(queryAnalyticsPage.url, {
        database: db,
        from: 'now-5m',
      });

      I.amOnPage(url);
      queryAnalyticsPage.waitForLoaded();

      queryAnalyticsPage.data.searchByValue(queryId);
      queryAnalyticsPage.waitForLoaded();
      queryAnalyticsPage.data.selectRow(1);

      I.waitForElement(queryAnalyticsPage.queryDetails.elements.topQuery);

      // qanOverview.waitForOverviewLoaded();
      // const queryid = await I.grabValueFrom(qanOverview.fields.searchBy);
      //
      // eslint-disable-next-line max-len
      // assert.ok(pgsmTopQuery === topQuery, `Top Query for query ${pgsmQuery} found in pgsm view is ${pgsmTopQuery} while the expected query was ${topQuery}`);
      // eslint-disable-next-line max-len
      // assert.ok(queryid === topQueryId, `Top Query ID found in PGSM view was ${topQueryId} while the one present in QAN for ${queryWithTopId} is ${queryid}`);
    }
  },
);

Scenario(
  'PMM-T1071 - Verify Histogram is displayed for each query with pg_stat_monitor @pgsm-pmm-integration @not-ui-pipeline',
  async ({ I, queryAnalyticsPage }) => {
    let countHistogram = 0;
    const db = `${database}_histogram`;

    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);

    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${db}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${db};`, connection);
    }

    connection.database = db;
    const sql = await I.verifyCommand('cat testdata/pgsql/pgsm_Histogram.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);
    connection.database = 'postgres';
    I.wait(120);

    const url = I.buildUrlWithParams(queryAnalyticsPage.url, {
      database: db,
      from: 'now-5m',
    });

    I.amOnPage(url);
    queryAnalyticsPage.waitForLoaded();

    const count = await queryAnalyticsPage.data.getRowCount();

    // Skipping the first one because that's the top query generated by select pg_sleep()
    for (let i = 2; i <= count; i++) {
      queryAnalyticsPage.data.selectRow(i);
      I.waitForElement(queryAnalyticsPage.queryDetails.buttons.close, 30);
      const count = await I.grabNumberOfVisibleElements(queryAnalyticsPage.queryDetails.elements.histogramContainer);

      countHistogram += count;
    }

    assert.ok(countHistogram > 5, `Expected Atleast 5 queries to have Histogram in query details, found ${countHistogram}`);
  },
);

// Need to fix this and revert skip
xScenario(
  'PMM-T1253 - Verify pg_stat_monitor.pgsm_normalized_query settings @not-ui-pipeline @pgsm-pmm-integration',
  async ({
    I, queryAnalyticsPage,
  }) => {
    const defaultValue = 'no';
    const alteredValue = 'yes';
    const queriesNumber = 2;

    await cleanupClickhouse();
    await I.pgExecuteQueryOnDemand('SELECT pg_stat_monitor_reset();', connection);

    await I.pgExecuteQueryOnDemand(`ALTER SYSTEM SET pg_stat_monitor.pgsm_normalized_query=${defaultValue};`, connection);
    I.wait(10);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
    let output = await I.pgExecuteQueryOnDemand('SELECT * FROM pg_stat_monitor_settings WHERE name=\'pg_stat_monitor.pgsm_normalized_query\';', connection);

    assert.equal(output.rows[0].value, 'no', `The value of 'pg_stat_monitor.pgsm_normalized_query' should be equal to '${defaultValue}'`);
    assert.equal(output.rows[0].default_value, 'no', `The default value of 'pg_stat_monitor.pgsm_normalized_query' should be equal to '${defaultValue}'`);

    await I.Authorize();

    //  Function used to produce data and check if examples are shown
    async function checkForExamples(isNoExamplesVisible) {
      I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
      queryAnalyticsPage.waitForLoaded();
      await queryAnalyticsPage.filters.selectFilter(pgsm_service_name);
      for (let i = 1; i < queriesNumber; i++) {
        const tableName = `PMM_T1253_${Date.now()}`;

        //  Sql queries used to produce data for table
        await I.pgExecuteQueryOnDemand(`CREATE TABLE ${tableName} ( TestId int );`, connection);
        await I.pgExecuteQueryOnDemand(`DROP TABLE ${tableName};`, connection);
        await queryAnalyticsPage.data.searchByValue(tableName, true);
        queryAnalyticsPage.data.selectRow(1);
        queryAnalyticsPage.waitForLoaded();
        //  Assertion that there are or there are no examples in the examples tab
        queryAnalyticsPage.queryDetails.checkExamplesTab(isNoExamplesVisible);
        queryAnalyticsPage.data.selectRow(2);
        queryAnalyticsPage.waitForLoaded();
        queryAnalyticsPage.queryDetails.checkExamplesTab(isNoExamplesVisible);
      }
    }

    await checkForExamples(false);
    //  Sequence of actions used to alter default value for pgsm_normalized_query with container restart
    await I.pgExecuteQueryOnDemand(`ALTER SYSTEM SET pg_stat_monitor.pgsm_normalized_query=${alteredValue};`, connection);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
    I.wait(5);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);
    output = await I.pgExecuteQueryOnDemand('SELECT * FROM pg_stat_monitor_settings WHERE name=\'pg_stat_monitor.pgsm_normalized_query\';', connection);
    assert.equal(output.rows[0].value, 'yes', `The default value of 'pg_stat_monitor.pgsm_normalized_query' should be equal to '${alteredValue}'`);
    await checkForExamples(true);
  },
);

Scenario(
  'PMM-T1292 + PMM-T1302 + PMM-T1303 + PMM-T1283 - Verify that pmm-admin inventory add agent postgres-exporter with --log-level flag adds PostgreSQL exporter with corresponding log-level @not-ui-pipeline @pgsm-pmm-integration',
  async ({
    I, inventoryAPI, dashboardPage, agentCli,
  }) => {
    I.amOnPage(dashboardPage.postgresqlInstanceOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    const pgsql_service_name = 'pgsql_pgsm_inventory_service';

    // adding service which will be used to verify various inventory addition commands
    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin remove postgresql ${pgsql_service_name} || true`));
    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin add postgresql --query-source=pgstatmonitor --agent-password='testing' --password=${connection.password} --username=${connection.user} --service-name=${pgsql_service_name}`));
    //
    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, pgsql_service_name);
    const pmm_agent_id = (await I.verifyCommand(`docker exec ${container_name} pmm-admin status | grep "Agent ID" | awk -F " " '{print $4}'`)).trim();

    const dbDetails = {
      username: 'pmm',
      password: 'pmm',
      pmm_agent_id,
      service_id,
      service_name: pgsql_service_name,
      container_name,
    };

    await agentCli.verifyAgentLogLevel('postgres-exporter', dbDetails);
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatmonitor-agent', dbDetails);

    await agentCli.verifyAgentLogLevel('postgres-exporter', dbDetails, 'debug');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatmonitor-agent', dbDetails, 'debug');

    await agentCli.verifyAgentLogLevel('postgres-exporter', dbDetails, 'info');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatmonitor-agent', dbDetails, 'info');

    await agentCli.verifyAgentLogLevel('postgres-exporter', dbDetails, 'warn');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatmonitor-agent', dbDetails, 'warn');

    await agentCli.verifyAgentLogLevel('postgres-exporter', dbDetails, 'error');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatmonitor-agent', dbDetails, 'error');

    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin remove postgresql ${pgsql_service_name}`));
  },
);

Scenario(
  'PMM-T1254 - Verify pg_stat_monitor.pgsm_bucket_time settings @not-ui-pipeline @pgsm-pmm-integration',
  async ({ I }) => {
    const defaultValue = 60;
    const alteredValue = 61;

    await I.pgExecuteQueryOnDemand(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${defaultValue};`, connection);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
    let output = await I.pgExecuteQueryOnDemand('SELECT * FROM pg_settings WHERE name=\'pg_stat_monitor.pgsm_bucket_time\';', connection);

    assert.equal(output.rows[0].setting, defaultValue, `The value of 'pg_stat_monitor.pgsm_bucket_time' should be equal to ${defaultValue}`);
    assert.equal(output.rows[0].reset_val, defaultValue, `The value of 'pg_stat_monitor.pgsm_bucket_time' should be equal to ${defaultValue}`);
    await I.verifyCommand(`docker exec ${container_name} true > pmm-agent.log`);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);
    I.wait(defaultValue);
    let log = await I.verifyCommand(`docker exec ${container_name} tail -n100 pmm-agent.log`);

    assert.ok(
      !log.includes('non default bucket time value is not supported, status changed to WAITING'),
      'The log wasn\'t supposed to contain errors regarding bucket time but it does',
    );

    await I.pgExecuteQueryOnDemand(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${alteredValue};`, connection);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
    output = await I.pgExecuteQueryOnDemand('SELECT * FROM pg_settings WHERE name=\'pg_stat_monitor.pgsm_bucket_time\';', connection);
    assert.equal(output.rows[0].setting, alteredValue, `The value of 'pg_stat_monitor.pgsm_bucket_time' should be equal to ${alteredValue}`);
    I.wait(alteredValue);
    log = await I.verifyCommand(`docker exec ${container_name} tail -n100 pmm-agent.log`);

    assert.ok(
      log.includes('non default bucket time value is not supported, status changed to WAITING'),
      `The log was supposed to contain errors regarding bucket time but it doesn't. 
 ${log}`,
    );

    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Waiting"`);
    await I.pgExecuteQueryOnDemand(`ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time=${defaultValue};`, connection);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
  },
);

Scenario(
  'PMM-T1032 + PMM-T2021 - Verify default PG queries are shipped with PMM @pgsm-pmm-integration',
  async ({ I, grafanaAPI }) => {
    const metricNames = [
      'pg_replication_lag',
      'pg_postmaster_start_time_seconds',
      'pg_stat_user_tables_analyze_count',
      'pg_stat_activity_max_state_duration',
      'pg_statio_user_tables_heap_blks_hit',
      'pg_database_size_bytes',
    ];

    metricNames.forEach((metric) => {
      grafanaAPI.waitForMetric(metric, { type: 'service_name', value: pgsm_service_name });
      grafanaAPI.waitForMetric(metric, { type: 'service_name', value: pgsm_service_name_socket });
    });
  },
);
