import Credentials from '@helpers/credentials.helper';
import { mongo, mysql, psql } from '@helpers/serviceConnection.helper';
import { GetService } from '@interfaces/inventory';

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
        noData: 'pg_stat_statements is not in shared_preload_libraries',
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
        noData: 'the slow query log is off unless pmm-framework set the server up for slowlog',
        value: 'slowlog',
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
        noData: 'mongod is not set up to log slow operations to a file the agent reads',
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
