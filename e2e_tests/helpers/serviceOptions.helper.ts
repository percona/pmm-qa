import { FrameworkService, frameworkServices } from '@helpers/frameworkServices.helper';
import { ServiceQan, serviceQanSources } from '@helpers/serviceQan.helper';
import { GetService, ServiceAgent } from '@interfaces/inventory';

export type OptionValue = boolean | number | Record<string, string> | string | string[];

export type OptionField =
  | 'authenticationDatabase'
  | 'authenticationMechanism'
  | 'autoDiscoveryLimit'
  | 'collectionsLimit'
  | 'disableCollectors'
  | 'disableCommentsParsing'
  | 'disableQueryExamples'
  | 'enableAllCollectors'
  | 'enableDiagnosticDataHistograms'
  | 'extraDsnParams'
  | 'maxExporterConnections'
  | 'maxQueryLength'
  | 'statsCollections'
  | 'tablestatsGroupTableLimit';

interface ServiceOption {
  // The agents that hold the option: the exporter, or whichever QAN agent the service has.
  agentTypes: string[];
  // The update API's name for the option, which puts the original value back.
  change: string;
  // What the running exporter's command line has to match, or must not, once the option is stored.
  commandLine?: (value: OptionValue) => undefined | { matches: boolean; pattern: RegExp };
  edit: (original: OptionValue) => OptionValue;
  field: OptionField;
  label: string;
  read: (agent: ServiceAgent) => OptionValue;
}

interface ServiceOptions extends FrameworkService {
  options: ServiceOption[];
}

const flag = (name: string) => new RegExp(`${name.replaceAll('.', '\\.')}(\\s|$)`);

export const readOption = ({ agentTypes, read }: ServiceOption, { agents, service_name }: GetService) => {
  const agent = agents.find(({ agent_type }) => agentTypes.includes(agent_type));

  if (!agent) throw new Error(`${service_name} has no ${agentTypes.join(' or ')}`);

  return read(agent);
};

// The form shows lists comma-separated and maps as name:value lines, as the API returns them.
export const toFormValue = (value: OptionValue): boolean | string => {
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([name, entry]) => `${name}:${entry}`)
      .join('\n');
  }

  return String(value);
};

// Lists and maps reach the update API wrapped, so that an empty one clears what is stored.
export const toOptionChange = ({ change }: ServiceOption, value: OptionValue) => ({
  [change]: Array.isArray(value) || (typeof value === 'object' && value !== null) ? { values: value } : value,
});

const other = (original: OptionValue, preferred: number, fallback: number) =>
  original === preferred ? fallback : preferred;

const qanOptions = ({ sources }: ServiceQan, examplesAndComments: boolean): ServiceOption[] => {
  const agentTypes = sources.map(({ agentType }) => agentType);

  return [
    {
      agentTypes,
      change: 'max_query_length',
      edit: (original) => other(original, 512, 1_024),
      field: 'maxQueryLength',
      label: 'QAN max query length',
      read: ({ max_query_length }) => Number(max_query_length ?? 0),
    },
    ...(examplesAndComments
      ? [
          {
            agentTypes,
            change: 'disable_query_examples',
            edit: (original: OptionValue) => !original,
            field: 'disableQueryExamples' as const,
            label: 'QAN disable query examples',
            read: ({ query_examples_disabled }: ServiceAgent) => !!query_examples_disabled,
          },
          {
            agentTypes,
            change: 'disable_comments_parsing',
            edit: (original: OptionValue) => !original,
            field: 'disableCommentsParsing' as const,
            label: 'QAN disable comments parsing',
            read: ({ comments_parsing_disabled }: ServiceAgent) => !!comments_parsing_disabled,
          },
        ]
      : []),
  ];
};

export const serviceOptionsSettings: ServiceOptions[] = [
  {
    ...frameworkServices.pdpgsql,
    options: [
      ...qanOptions(serviceQanSources.pdpgsql, true),
      {
        agentTypes: ['postgres_exporter'],
        change: 'disable_collectors',
        commandLine: () => ({ matches: false, pattern: flag('--collect.custom_query.mr') }),
        edit: () => ['custom_query.mr'],
        field: 'disableCollectors',
        label: 'disabled collectors',
        read: ({ disabled_collectors }) => disabled_collectors ?? [],
      },
      {
        agentTypes: ['postgres_exporter'],
        change: 'auto_discovery_limit',
        // A negative limit always turns database auto-discovery off.
        commandLine: (value) =>
          Number(value) < 0 ? { matches: false, pattern: flag('--auto-discover-databases') } : undefined,
        edit: (original) => other(original, -1, 10),
        field: 'autoDiscoveryLimit',
        label: 'auto-discovery limit',
        read: ({ postgresql_options }) => Number(postgresql_options?.auto_discovery_limit ?? 0),
      },
      {
        agentTypes: ['postgres_exporter'],
        change: 'max_exporter_connections',
        commandLine: (value) => ({ matches: true, pattern: flag(`--max-connections=${value}`) }),
        edit: (original) => other(original, 5, 6),
        field: 'maxExporterConnections',
        label: 'max exporter connections',
        read: ({ postgresql_options }) => Number(postgresql_options?.max_exporter_connections ?? 0),
      },
    ],
  },
  {
    ...frameworkServices.ps,
    options: [
      ...qanOptions(serviceQanSources.ps, true),
      {
        agentTypes: ['mysqld_exporter'],
        change: 'disable_collectors',
        commandLine: () => ({ matches: false, pattern: flag('--collect.global_variables') }),
        edit: () => ['global_variables', 'heartbeat'],
        field: 'disableCollectors',
        label: 'disabled collectors',
        read: ({ disabled_collectors }) => disabled_collectors ?? [],
      },
      {
        agentTypes: ['mysqld_exporter'],
        change: 'tablestats_group_table_limit',
        // A negative limit always leaves out the table statistics collectors.
        commandLine: (value) =>
          Number(value) < 0
            ? { matches: false, pattern: flag('--collect.info_schema.tablestats') }
            : undefined,
        edit: (original) => other(original, -1, 2_000),
        field: 'tablestatsGroupTableLimit',
        label: 'tablestats limit',
        read: ({ table_count_tablestats_group_limit }) => Number(table_count_tablestats_group_limit ?? 0),
      },
      {
        agentTypes: ['mysqld_exporter'],
        change: 'extra_dsn_params',
        // pmm-managed refuses every other parameter.
        edit: () => ({ allowCleartextPasswords: 'true' }),
        field: 'extraDsnParams',
        label: 'extra DSN parameters',
        read: ({ mysql_options }) => mysql_options?.extra_dsn_params ?? {},
      },
    ],
  },
  {
    ...frameworkServices.psmdb,
    options: [
      ...qanOptions(serviceQanSources.psmdb, false),
      {
        agentTypes: ['mongodb_exporter'],
        change: 'enable_all_collectors',
        commandLine: (value) => ({ matches: !!value, pattern: flag('--collector.dbstats') }),
        edit: (original) => !original,
        field: 'enableAllCollectors',
        label: 'enable all collectors',
        read: ({ mongo_db_options }) => !!mongo_db_options?.enable_all_collectors,
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'enable_diagnostic_data_histograms',
        commandLine: (value) => ({
          matches: !!value,
          pattern: flag('--collector.diagnosticdata-histograms'),
        }),
        edit: (original) => !original,
        field: 'enableDiagnosticDataHistograms',
        label: 'diagnostic data histograms',
        read: ({ mongo_db_options }) => !!mongo_db_options?.enable_diagnostic_data_histograms,
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'stats_collections',
        commandLine: (value) => ({
          matches: true,
          pattern: flag(`--mongodb.collstats-colls=${(value as string[]).join(',')}`),
        }),
        edit: () => ['db1', 'db2.col2'],
        field: 'statsCollections',
        label: 'stats collections',
        read: ({ mongo_db_options }) => mongo_db_options?.stats_collections ?? [],
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'collections_limit',
        commandLine: (value) => ({ matches: true, pattern: flag(`--collector.collstats-limit=${value}`) }),
        edit: (original) => other(original, 100, 150),
        field: 'collectionsLimit',
        label: 'collections limit',
        read: ({ mongo_db_options }) => Number(mongo_db_options?.collections_limit ?? 0),
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'disable_collectors',
        commandLine: () => ({ matches: false, pattern: flag('--collector.fcv') }),
        edit: () => ['fcv'],
        field: 'disableCollectors',
        label: 'disabled collectors',
        read: ({ disabled_collectors }) => disabled_collectors ?? [],
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'authentication_mechanism',
        // pmm-framework's mongod allows only SCRAM-SHA-1 and GSSAPI, so the switch is to and from the default.
        edit: (original) => (original === 'SCRAM-SHA-1' ? '' : 'SCRAM-SHA-1'),
        field: 'authenticationMechanism',
        label: 'authentication mechanism',
        read: ({ mongo_db_options }) => mongo_db_options?.authentication_mechanism ?? '',
      },
      {
        agentTypes: ['mongodb_exporter'],
        change: 'authentication_database',
        // The pmm user lives in admin, the default authentication database.
        edit: (original) => (original === 'admin' ? '' : 'admin'),
        field: 'authenticationDatabase',
        label: 'authentication database',
        read: ({ mongo_db_options }) => mongo_db_options?.authentication_database ?? '',
      },
    ],
  },
  {
    ...frameworkServices.proxysql,
    options: [
      {
        agentTypes: ['proxysql_exporter'],
        change: 'disable_collectors',
        commandLine: () => ({ matches: false, pattern: flag('-collect.mysql_connection_list') }),
        edit: () => ['mysql_connection_list'],
        field: 'disableCollectors',
        label: 'disabled collectors',
        read: ({ disabled_collectors }) => disabled_collectors ?? [],
      },
    ],
  },
];
