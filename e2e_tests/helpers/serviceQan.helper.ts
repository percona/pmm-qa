import {
  FrameworkService,
  frameworkServices,
  ownMongod,
  OwnService,
} from '@helpers/frameworkServices.helper';
import Credentials from '@helpers/credentials.helper';
import { mongo, mysql, psql } from '@helpers/serviceConnection.helper';
import { GetService, ServiceType } from '@interfaces/inventory';

export const querySources = [
  'none',
  'perfschema',
  'slowlog',
  'profiler',
  'mongolog',
  'pgstatements',
  'pgstatmonitor',
] as const;

export type QuerySource = (typeof querySources)[number];

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

export interface ServiceQan extends FrameworkService {
  cleanup?: (container: string, credentials: Credentials) => string;
  // Puts back a server setting a workload turns on, from what saveState printed before the test.
  restoreState?: (container: string, credentials: Credentials, saved: string) => string;
  // Prints, as its last line, the statement that restores a server setting a workload turns on.
  saveState?: (container: string, credentials: Credentials) => string;
  sources: QanAgentSource[];
}

const qanCheckDatabase = 'pmm_qan_check';

export const serviceQanSources: Record<'pdpgsql' | 'ps' | 'psmdb', ServiceQan> = {
  pdpgsql: {
    ...frameworkServices.pdpgsql,
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
  ps: {
    ...frameworkServices.ps,
    restoreState: (container, credentials, saved) => mysql(container, credentials, saved),
    saveState: (container, credentials) =>
      mysql(container, credentials, "SELECT CONCAT('SET GLOBAL slow_query_log = ', @@global.slow_query_log)"),
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
  psmdb: {
    ...frameworkServices.psmdb,
    cleanup: (container, credentials) =>
      mongo(container, credentials, `db.getSiblingDB("${qanCheckDatabase}").dropDatabase()`),
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
};

export const offeredQuerySources = ({ sources }: ServiceQan): QuerySource[] => [
  'none',
  ...sources.map(({ value }) => value),
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

interface QanInstance extends Required<OwnService> {
  agentType: string;
  // The framework service whose container the instance runs in, so its pmm-agent can read the source.
  hostServiceRegex: string;
  name: string;
  querySource: QuerySource;
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
    hostServiceRegex: frameworkServices.pdpgsql.serviceRegex,
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
    // mongod logs an operation only when it takes longer than slowms, so the workload's query sleeps.
    ...ownMongod({
      dir: mongologDir,
      mongodFlags: '--slowms 0',
      port: mongologPort,
      serviceName: 'pmm_qan_mongolog_check',
    }),
    agentType: 'qan-mongodb-mongolog-agent',
    hostServiceRegex: frameworkServices.psmdb.serviceRegex,
    name: 'MongoDB logging to a file',
    querySource: 'mongolog',
    workload: (container) =>
      `docker exec ${container} mongo --quiet --port ${mongologPort} --eval 'const check = db.getSiblingDB("${qanCheckDatabase}"); check.checks.insertOne({ a: 1 }); check.checks.find({ $where: "sleep(5) || true" }).toArray()'`,
  },
];
