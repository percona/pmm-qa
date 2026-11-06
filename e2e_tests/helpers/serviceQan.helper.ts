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
  value: QuerySource;
}

export interface ServiceQan {
  name: string;
  serviceRegex: string;
  sources: QanAgentSource[];
}

export const serviceQanSources: ServiceQan[] = [
  {
    name: 'pdpgsql',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
    sources: [
      {
        agentType: 'qan_postgresql_pgstatements_agent',
        change: 'qan_postgresql_pgstatements_agent',
        value: 'pgstatements',
      },
      {
        agentType: 'qan_postgresql_pgstatmonitor_agent',
        change: 'qan_postgresql_pgstatmonitor_agent',
        value: 'pgstatmonitor',
      },
    ],
  },
  {
    name: 'ps',
    serviceRegex: '^ps_pmm',
    sources: [
      { agentType: 'qan_mysql_perfschema_agent', change: 'qan_mysql_perfschema', value: 'perfschema' },
      { agentType: 'qan_mysql_slowlog_agent', change: 'qan_mysql_slowlog', value: 'slowlog' },
    ],
  },
  {
    name: 'psmdb',
    serviceRegex: '^rs101_',
    sources: [
      { agentType: 'qan_mongodb_profiler_agent', change: 'qan_mongodb_profiler', value: 'profiler' },
      { agentType: 'qan_mongodb_mongolog_agent', change: 'qan_mongodb_mongolog', value: 'mongolog' },
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
