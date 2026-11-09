import Credentials from '@helpers/credentials.helper';
import { mongo, mysql, psql } from '@helpers/serviceConnection.helper';
import { GetService, ServiceType } from '@interfaces/inventory';

export type QuerySource =
  'mongolog' | 'none' | 'perfschema' | 'pgstatements' | 'pgstatmonitor' | 'profiler' | 'slowlog';

export const querySources: QuerySource[] = [
  'none',
  'perfschema',
  'slowlog',
  'profiler',
  'mongolog',
  'pgstatements',
  'pgstatmonitor',
];

interface QanAgentSource {
  agentType: string;
  // The update API's switch for this QAN agent: true creates it, false removes it.
  change: string;
  // Why pmm-framework's database gives this source no queries to report, when it does not.
  noData?: string;
  value: QuerySource;
  // Runs a query this source reports, so its QAN agent has data to send.
  workload?: (container: string, credentials: Credentials) => string;
}

export interface ServiceQan {
  // Undoes what the workloads changed in the database.
  cleanup?: (container: string, credentials: Credentials) => string;
  name: string;
  // Puts back a server setting a workload turns on, from what saveState printed before the test.
  restoreState?: (container: string, credentials: Credentials, saved: string) => string;
  // Prints, as its last line, the statement that restores a server setting a workload turns on.
  saveState?: (container: string, credentials: Credentials) => string;
  serviceRegex: string;
  sources: QanAgentSource[];
}

const qanCheckDatabase = 'pmm_qan_check';

export const serviceQanSources: ServiceQan[] = [
  {
    name: 'pdpgsql',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
    sources: [
      {
        agentType: 'qan-postgresql-pgstatements-agent',
        change: 'qan_postgresql_pgstatements_agent',
        noData: "pmm-framework does not preload pg_stat_statements; a PostgreSQL of the test's own covers it",
        value: 'pgstatements',
      },
      {
        agentType: 'qan-postgresql-pgstatmonitor-agent',
        change: 'qan_postgresql_pgstatmonitor_agent',
        value: 'pgstatmonitor',
        workload: (container) => psql(container, 'SELECT 1 AS pmm_qan_check'),
      },
    ],
  },
  {
    name: 'ps',
    restoreState: (container, credentials, saved) => mysql(container, credentials, saved),
    saveState: (container, credentials) =>
      mysql(container, credentials, "SELECT CONCAT('SET GLOBAL slow_query_log = ', @@global.slow_query_log)"),
    serviceRegex: '^ps_pmm',
    sources: [
      {
        agentType: 'qan-mysql-perfschema-agent',
        change: 'qan_mysql_perfschema',
        value: 'perfschema',
        workload: (container, credentials) => mysql(container, credentials, 'SELECT 1 AS pmm_qan_check'),
      },
      {
        agentType: 'qan-mysql-slowlog-agent',
        change: 'qan_mysql_slowlog',
        value: 'slowlog',
        // Only the switch is global; the zero threshold applies to this session alone.
        workload: (container, credentials) =>
          mysql(
            container,
            credentials,
            'SET GLOBAL slow_query_log = ON; SET SESSION long_query_time = 0; SELECT 1 AS pmm_qan_check',
          ),
      },
    ],
  },
  {
    cleanup: (container, credentials) =>
      mongo(container, credentials, `db.getSiblingDB("${qanCheckDatabase}").dropDatabase()`),
    name: 'psmdb',
    serviceRegex: '^rs101_',
    sources: [
      {
        agentType: 'qan-mongodb-profiler-agent',
        change: 'qan_mongodb_profiler',
        value: 'profiler',
        // Profiling is turned on only for a database of the test's own, which cleanup drops.
        workload: (container, credentials) =>
          mongo(
            container,
            credentials,
            `const check = db.getSiblingDB("${qanCheckDatabase}"); check.setProfilingLevel(2); check.checks.insertOne({ a: 1 }); check.checks.find({ a: 1 }).toArray()`,
          ),
      },
      {
        agentType: 'qan-mongodb-mongolog-agent',
        change: 'qan_mongodb_mongolog',
        noData: "pmm-framework's mongod logs to syslog, not a file; a mongod of the test's own covers it",
        value: 'mongolog',
      },
    ],
  },
];

export const qanAgentTypes = ({ sources }: ServiceQan, { agents }: GetService) =>
  agents
    .map(({ agent_type }) => agent_type)
    .filter((type) => sources.some(({ agentType }) => agentType === type));

export const currentQuerySource = (serviceQan: ServiceQan, service: GetService): QuerySource =>
  serviceQan.sources.find(({ agentType }) => qanAgentTypes(serviceQan, service).includes(agentType))?.value ??
  'none';

export const querySourceChanges = ({ sources }: ServiceQan, querySource: QuerySource) =>
  Object.fromEntries(sources.map(({ change, value }) => [change, value === querySource]));

export interface QanInstance {
  agentType: string;
  // The framework service whose container the instance runs in, so its pmm-agent can read the source.
  hostServiceRegex: string;
  name: string;
  querySource: QuerySource;
  // Registers the instance with no query source, for the form to pick one.
  register: (container: string) => string;
  serviceName: string;
  serviceType: ServiceType;
  start: (container: string) => string;
  stop: (container: string) => string;
  workload: (container: string) => string;
}

const pgstatementsDir = '/tmp/pmm_qan_pgstatements';
const pgstatementsPort = 5_499;
const pgBin = 'bin=$(ls -d /usr/pgsql-*/bin | head -n 1)';
const pgCommand = (container: string, script: string) =>
  `docker exec --user postgres ${container} sh -c '${pgBin}; ${script}'`;
const mongologDir = '/tmp/pmm_qan_mongolog';
const mongologPort = 27_099;

// pmm-framework's databases cannot report these sources, and enabling them needs a restart, so each
// test starts a small database of its own next to the framework's and removes it afterwards.
export const qanInstances: QanInstance[] = [
  {
    agentType: 'qan-postgresql-pgstatements-agent',
    hostServiceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
    name: 'PostgreSQL with pg_stat_statements',
    querySource: 'pgstatements',
    register: (container) =>
      `docker exec ${container} pmm-admin add postgresql --username=postgres --password=pmm --host=127.0.0.1 --port=${pgstatementsPort} --query-source=none pmm_qan_pgstatements_check`,
    serviceName: 'pmm_qan_pgstatements_check',
    serviceType: ServiceType.postgresql,
    start: (container) =>
      pgCommand(
        container,
        `rm -rf ${pgstatementsDir} && $bin/initdb -D ${pgstatementsDir} --auth=trust -U postgres >/dev/null && $bin/pg_ctl -D ${pgstatementsDir} -l ${pgstatementsDir}/server.log -w -o "-p ${pgstatementsPort} -k /tmp -c listen_addresses=127.0.0.1 -c shared_preload_libraries=pg_stat_statements" start >/dev/null && $bin/psql -h 127.0.0.1 -p ${pgstatementsPort} -U postgres -c "CREATE EXTENSION pg_stat_statements" >/dev/null`,
      ),
    stop: (container) =>
      pgCommand(
        container,
        `$bin/pg_ctl -D ${pgstatementsDir} -m fast stop >/dev/null 2>&1; rm -rf ${pgstatementsDir}`,
      ),
    workload: (container) =>
      pgCommand(
        container,
        `$bin/psql -h 127.0.0.1 -p ${pgstatementsPort} -U postgres -c "SELECT 1 AS pmm_qan_check"`,
      ),
  },
  {
    agentType: 'qan-mongodb-mongolog-agent',
    hostServiceRegex: '^rs101_',
    name: 'MongoDB logging to a file',
    querySource: 'mongolog',
    register: (container) =>
      `docker exec ${container} pmm-admin add mongodb --host=127.0.0.1 --port=${mongologPort} --query-source=none pmm_qan_mongolog_check`,
    serviceName: 'pmm_qan_mongolog_check',
    serviceType: ServiceType.mongodb,
    // mongod logs an operation only when it takes longer than slowms, so the workload's query sleeps.
    start: (container) =>
      `docker exec ${container} sh -c 'rm -rf ${mongologDir} && mkdir -p ${mongologDir} && mongod --port ${mongologPort} --bind_ip 127.0.0.1 --dbpath ${mongologDir} --logpath ${mongologDir}/mongod.log --fork --slowms 0 >/dev/null'`,
    stop: (container) =>
      `docker exec ${container} sh -c 'mongod --dbpath ${mongologDir} --shutdown >/dev/null 2>&1; rm -rf ${mongologDir}'`,
    workload: (container) =>
      `docker exec ${container} mongo --quiet --port ${mongologPort} --eval 'const check = db.getSiblingDB("${qanCheckDatabase}"); check.checks.insertOne({ a: 1 }); check.checks.find({ $where: "sleep(5) || true" }).toArray()'`,
  },
];
