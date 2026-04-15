const assert = require('assert');
const {
  SERVICE_TYPE,
  CLI_AGENT_STATUS,
} = require('../helper/constants');

const { adminPage } = inject();
const connection = {
  host: '127.0.0.1',
  port: 5448,
  user: 'postgres',
  password: 'pass+this',
  database: 'postgres',
};

// Service Name is determined by value of env variable PGSQL_PGSS_CONTAINER and version PGSQL_VERSION
// default value for docker container is pgsql_pgss, version is 14, port 5438 is accessible on the host system
// Service Name: ${PGSQL_PGSS_CONTAINER}_${PGSQL_VERSION}_service
// Docker Container Name: ${PGSQL_PGSS_CONTAINER}_${PGSQL_VERSION}

const version = process.env.PGSQL_VERSION ? `${process.env.PGSQL_VERSION}` : '17';
const container = process.env.PGSQL_PGSS_CONTAINER ? `${process.env.PGSQL_PGSS_CONTAINER}` : 'pgsql_pgss_pmm';
const database = `pgss${Math.floor(Math.random() * 99) + 1}`;
let pgss_service_name;
const container_name = `${container}_${version}`;
const pmmFrameworkLoader = `bash ${adminPage.pathToFramework}`;
const pgsqlVersionPgss = new DataTable(['pgsqlVersion', 'expectedPgssVersion', 'expectedColumnName']);

// TODO: unskip when pmm-framework takes port parameter https://perconadev.atlassian.net/browse/PMM-13096
// pgsqlVersionPgss.add([12, '1.7', 'total_time']);
// pgsqlVersionPgss.add([13, '1.8', 'total_exec_time']);

const labels = [{ key: 'database', value: [`${database}`] }];

Feature('PMM + pgss Integration Scenarios');

BeforeSuite(async ({ inventoryAPI }) => {
  const pgss_service = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pgsql_');

  pgss_service_name = pgss_service.service_name;
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1868 - pg_stat_statements is used if no --query-source flag provided and pg_stat_monitor is not configured @not-ui-pipeline @pgss-pmm-integration',
  async ({ I }) => {
    const serviceName = `pgss_${Math.floor(Math.random() * 99) + 1}`;
    const commandOut = await I.verifyCommand(`docker exec ${container_name} pmm-admin add postgresql --json --password=${connection.password} --username=${connection.user} --service-name=${serviceName}`);
    const { service: { service_id: serviceId }, warning } = JSON.parse(commandOut);

    assert.ok(warning === 'Could not to detect the pg_stat_monitor extension on your system. Falling back to the pg_stat_statements.', `Expected warning message, but received \n${commandOut}`);

    let list;
    let serviceAgents;

    await I.asyncWaitFor(async () => {
      list = JSON.parse(
        await I.verifyCommand(`docker exec ${container_name} pmm-admin list --json`),
      );
      serviceAgents = list.agent.filter(({ service_id }) => service_id === serviceId);
      const pgStatStatementsAgent = serviceAgents.find(({ agent_type }) => agent_type === 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT');

      assert.ok(pgStatStatementsAgent, 'pg_stat_statements agent should exist');

      return pgStatStatementsAgent.status === CLI_AGENT_STATUS.RUNNING;
    }, 30);

    const pgStatMonitorAgent = serviceAgents.find(({ agent_type }) => agent_type === 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT');

    assert.ok(!pgStatMonitorAgent, 'pg_stat_monitor agent should not exist');
  },
);

Scenario(
  'PMM-T1312 - Adding Load to Postgres test database and verifying PMM-Agent and PG_STATEMENTS QAN agent is in running status @not-ui-pipeline @pgss-pmm-integration',
  async ({ I }) => {
    await I.pgExecuteQueryOnDemand('SELECT now();', connection);

    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${database}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${database};`, connection);
      await I.pgExecuteQueryOnDemand(`ALTER DATABASE ${database} owner to pmm;`, connection);
    }

    connection.database = database;
    const sql = await I.verifyCommand('cat testdata/pgsql/pgss_load.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);
    connection.database = 'postgres';
    // wait for pmm-agent to push the execution as part of next bucket to clickhouse
    I.wait(90);

    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatements_agent" | grep "Running"`);
  },
);

Scenario.skip(
  'PMM-T1313 - Verifying data in Clickhouse and comparing with pgss output @not-ui-pipeline @pgss-pmm-integration',
  async ({ I, qanAPI }) => {
    // Clear metrics in clickhouse
    await I.verifyCommand('docker exec pmm-server clickhouse-client --password clickhouse --database pmm --query "TRUNCATE TABLE metrics"');

    await I.pgExecuteQueryOnDemand('SELECT now();', connection);

    const output = await I.pgExecuteQueryOnDemand(`SELECT * FROM pg_database where datname= '${database}';`, connection);

    if (output.rows.length === 0) {
      await I.pgExecuteQueryOnDemand(`Create database ${database};`, connection);
      await I.pgExecuteQueryOnDemand(`ALTER DATABASE ${database} owner to pmm;`, connection);
    }

    connection.database = database;
    const sql = await I.verifyCommand('cat testdata/pgsql/pgss_load.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);
    connection.database = 'postgres';
    // wait for pmm-agent to push the execution as part of next bucket to clickhouse
    I.wait(150);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatements_agent" | grep "Running"`);

    let toStart = new Date();

    const fromStart = new Date(toStart.getTime() - (5 * 60000));

    toStart = new Date(toStart.getTime() + (2 * 60000));

    I.wait(5);
    const dbid = await I.pgExecuteQueryOnDemand(`select oid from pg_database where datname='${database}';`, connection);
    const pgss_output = await I.pgExecuteQueryOnDemand(`select query, queryid, calls, total_exec_time, mean_exec_time  from pg_stat_statements where dbid='${dbid.rows[0].oid}';`, connection);
    const excludedQueries = ['SELECT version()'];

    for (let i = 0; i < pgss_output.rows.length; i++) {
      const response = await qanAPI.getMetricByFilterAPI(pgss_output.rows[i].queryid, 'queryid', labels, fromStart.toISOString(), toStart.toISOString());
      // we do this conversion because clickhouse has values in micro seconds, while pgss has in milliseconds.
      const total_exec_time = parseFloat((pgss_output.rows[i].total_exec_time / 1000).toFixed(7));
      const average_exec_time = parseFloat((pgss_output.rows[i].mean_exec_time / 1000).toFixed(7));
      const query_cnt = parseInt(pgss_output.rows[i].calls, 10);
      const { query, queryid } = pgss_output.rows[i];

      if (response.status !== 200) {
        I.say(`Expected queryid with id as ${queryid} and query as ${query} to have data in clickhouse but got response as ${response.code}`);
        continue;
      }

      if (!excludedQueries.includes(query)) {
        I.say(`PGSS QUERY: ${JSON.stringify(query, null, 2)}`);
        I.say(`CLICKHOUSE QUERY TIME: ${JSON.stringify(response.data.metrics.query_time)}`);

        const clickhouse_sum = parseFloat((response.data.metrics.query_time.sum).toFixed(7));
        const clickhouse_avg = parseFloat((response.data.metrics.query_time.avg).toFixed(7));

        // Due to rounding difference we sometimes have values which differ in points 0.0000001
        const avg_diff = Number(average_exec_time - clickhouse_avg).toFixed(7);
        const total_diff = Number(total_exec_time - clickhouse_sum).toFixed(7);

        assert.ok(total_diff <= 0.0000001, `Expected Total Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_sum} on clickhouse while PGSS has ${total_exec_time}`);
        assert.ok(avg_diff <= 0.0000001, `Expected Average Query Time Metrics to be same for query ${query} with id as ${queryid} found ${clickhouse_avg} on clickhouse while PGSS has ${average_exec_time}`);
        assert.ok(response.data.metrics.query_time.cnt === query_cnt, `Expected Total Query Count Metrics to be same for query ${query} with id as ${queryid} found in clickhouse as ${response.data.metrics.query_time.cnt} while pgss has value as ${query_cnt}`);
      }
    }
  },
);

Scenario(
  'PMM-T2037 - Verify QPS after changing pg_statements.max value @not-ui-pipeline @pgss-pmm-integration',
  async ({ I, queryAnalyticsPage }) => {
    await I.cleanupClickhouse();

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));

    await I.verifyCommand(`docker exec ${container_name} psql -U ${connection.user} -c "ALTER SYSTEM SET max_locks_per_transaction = 1024;"`);
    await I.verifyCommand(`docker exec ${container_name} psql -U ${connection.user} -c "ALTER SYSTEM SET pg_stat_statements.max = 20000;"`);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);

    const sql = await I.verifyCommand('cat testdata/pgsql/pgss_pmm_t2037.sql');

    await I.pgExecuteQueryOnDemand(sql, connection);

    await I.verifyCommand(`docker exec ${container_name} psql -U ${connection.user} -c "ALTER SYSTEM SET pg_stat_statements.max = 5000;"`);
    await I.verifyCommand(`docker exec ${container_name} service postgresql restart`);
    await I.pgExecuteQueryOnDemand(sql, connection);

    I.wait(60);

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));

    queryAnalyticsPage.waitForLoaded();
    await queryAnalyticsPage.filters.selectContainFilter(pgss_service_name);
    queryAnalyticsPage.waitForLoaded();
    I.waitForElement(queryAnalyticsPage.data.elements.queryRowQueryCountValue(0), 30);
    const value = await I.grabTextFrom(queryAnalyticsPage.data.elements.queryRowQueryCountValue(0));

    assert.ok(!/[\d.]+m\s*qps/i.test(value), `TOTAL QPS value should not be in millions. Actual value: ${value}`);
  },
);

Scenario(
  'PMM-T1301 + PMM-T1300 - Verify that pmm-admin inventory add agent qan-postgresql-pgstatements-agent with --log-level flag adds QAN PostgreSQL PgStatements Agent with corresponding log-level @not-ui-pipeline @pgss-pmm-integration',
  async ({
    I, inventoryAPI, agentCli, dashboardPage,
  }) => {
    I.amOnPage(dashboardPage.postgresqlInstanceOverviewDashboard.url);
    dashboardPage.waitForDashboardOpened();
    const pgsql_service_name = 'pgsql_pgss_inventory_service';

    // adding service which will be used to verify various inventory addition commands
    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin remove postgresql ${pgsql_service_name} || true`));
    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin add postgresql --query-source=pgstatements --agent-password='testing' --password=${connection.password} --username=${connection.user} --service-name=${pgsql_service_name}`));
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

    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatements-agent', dbDetails);
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatements-agent', dbDetails, 'debug');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatements-agent', dbDetails, 'info');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatements-agent', dbDetails, 'warn');
    await agentCli.verifyAgentLogLevel('qan-postgresql-pgstatements-agent', dbDetails, 'error');

    await I.say(await I.verifyCommand(`docker exec ${container_name} pmm-admin remove postgresql ${pgsql_service_name}`));
  },
);

Data(pgsqlVersionPgss).Scenario(
  '@PMM-T1540 @PMM-T1541 Verify that QAN pg_stat_statements agent collects "total_time" column for pg_stat_statements version 1.7 and lower'
    + 'Verify that QAN pg_stat_statements agent collects "total_exec_time" column for pg_stat_statements version 1.8 and higher @pgss-pmm-integration',
  async ({ I, inventoryAPI, current }) => {
    const {
      pgsqlVersion,
      expectedPgssVersion,
      expectedColumnName,
    } = current;
    const containerName = `pgsql_pgss_${pgsqlVersion}`;
    const exposedPort = '5444';
    const serviceName = `pgsql_pgss_${pgsqlVersion}_service`;

    await I.say(`${pmmFrameworkLoader} --pmm2 --setup-pmm-pgss-integration --pgsql-version=${pgsqlVersion} --pgsql-pgss-port=${exposedPort}`);
    await I.verifyCommand(`export ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD}`);

    const out = await I.verifyCommand(`sudo -E ${pmmFrameworkLoader} --pmm2 --setup-pmm-pgss-integration --pgsql-version=${pgsqlVersion} --pgsql-pgss-port=${exposedPort}`);

    await I.say(out);

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.POSTGRESQL,
        service: 'postgresql',
      },
      serviceName,
    );
    await I.assertContain(
      await I.verifyCommand(`docker exec ${containerName} psql postgres postgres -c "select column_name from information_schema.columns where table_name='pg_stat_statements' and column_name='${expectedColumnName}'"`),
      expectedColumnName,
      `Expected to find column with name ${expectedColumnName} in pg_stat_statements table for pgsql version ${pgsqlVersion}`,
    );
    const actualPgssVersion = (await I.verifyCommand(`docker exec ${containerName} psql postgres postgres -c "SELECT pg_extension.extversion FROM pg_extension WHERE pg_extension.extname = 'pg_stat_statements'" | grep -Eo "[0-9]*\\.[0-9]*"`)).replace('\n', '');

    await I.assertEqual(actualPgssVersion, expectedPgssVersion, `PGSS version is not correct for this version (${pgsqlVersion}) of PGSQL`);

    await I.assertEqual(
      parseInt(await I.verifyCommand(`tail -n100 ~/pmm-agent.log | grep -o "column pg_stat_statements.${expectedColumnName} does not exist" | wc -l`), 10),
      0,
      'Expected to have no errors regarding column name',
    );

    const { service_id } = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, serviceName);

    await inventoryAPI.deleteService(service_id);
    await I.verifyCommand(`docker rm -f ${containerName}`);
  },
);
