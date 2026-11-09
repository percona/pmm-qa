import { GetService } from '@interfaces/inventory';

type ServiceAgent = GetService['agents'][number];

export type MetricsMode = 'METRICS_MODE_PULL' | 'METRICS_MODE_PUSH';

export type LogLevel =
  | 'LOG_LEVEL_DEBUG'
  | 'LOG_LEVEL_ERROR'
  | 'LOG_LEVEL_FATAL'
  | 'LOG_LEVEL_INFO'
  | 'LOG_LEVEL_UNSPECIFIED'
  | 'LOG_LEVEL_WARN';

export const logLevelLabels: Record<LogLevel, string> = {
  LOG_LEVEL_DEBUG: 'Debug',
  LOG_LEVEL_ERROR: 'Error',
  LOG_LEVEL_FATAL: 'Fatal',
  LOG_LEVEL_INFO: 'Info',
  LOG_LEVEL_UNSPECIFIED: 'Default',
  LOG_LEVEL_WARN: 'Warning',
};

export interface ServiceMetricsSettings {
  // Seconds as the form shows them, blank for the default.
  connectionTimeout: string;
  exposeExporter: boolean;
  logLevel: LogLevel;
  metricsMode: MetricsMode;
}

export interface ServiceMetrics {
  exporterType: string;
  // mysqld_exporter, postgres_exporter and valkey_exporter have no fatal level, so the form leaves it out.
  fatalLogLevel: boolean;
  name: string;
  serviceRegex: string;
  // The exporter's own up metric, whose fresh samples show its metrics still reach PMM Server.
  upMetric: string;
}

export const serviceMetricsSettings: ServiceMetrics[] = [
  {
    exporterType: 'postgres_exporter',
    fatalLogLevel: false,
    name: 'pdpgsql',
    serviceRegex: '^pdpgsql_pmm_(?!.*patroni).*$',
    upMetric: 'pg_up',
  },
  {
    exporterType: 'mysqld_exporter',
    fatalLogLevel: false,
    name: 'ps',
    serviceRegex: '^ps_pmm',
    upMetric: 'mysql_up',
  },
  {
    exporterType: 'mongodb_exporter',
    fatalLogLevel: true,
    name: 'psmdb',
    serviceRegex: '^rs101_',
    upMetric: 'mongodb_up',
  },
  {
    exporterType: 'valkey_exporter',
    fatalLogLevel: false,
    name: 'valkey',
    serviceRegex: '^valkey-primary',
    upMetric: 'redis_up',
  },
  {
    exporterType: 'proxysql_exporter',
    fatalLogLevel: true,
    name: 'proxysql',
    serviceRegex: '^my-new-proxysql_',
    upMetric: 'proxysql_up',
  },
];

export const offeredLogLevels = ({ fatalLogLevel }: ServiceMetrics): LogLevel[] => [
  'LOG_LEVEL_UNSPECIFIED',
  ...(fatalLogLevel ? (['LOG_LEVEL_FATAL'] as const) : []),
  'LOG_LEVEL_ERROR',
  'LOG_LEVEL_WARN',
  'LOG_LEVEL_INFO',
  'LOG_LEVEL_DEBUG',
];

// The API gives the timeout as a protobuf duration such as "7.500s".
export const toMetricsSettings = ({
  connection_timeout,
  expose_exporter,
  log_level,
  push_metrics,
}: ServiceAgent): ServiceMetricsSettings => {
  const seconds = parseFloat(connection_timeout ?? '');

  return {
    connectionTimeout: seconds > 0 ? String(seconds) : '',
    exposeExporter: !!expose_exporter,
    logLevel: (log_level || 'LOG_LEVEL_UNSPECIFIED') as LogLevel,
    metricsMode: push_metrics ? 'METRICS_MODE_PUSH' : 'METRICS_MODE_PULL',
  };
};

// Zero seconds and LOG_LEVEL_UNSPECIFIED put the server's defaults back.
export const metricsSettingsChanges = ({
  connectionTimeout,
  exposeExporter,
  logLevel,
  metricsMode,
}: ServiceMetricsSettings) => ({
  connection_timeout: `${Number(connectionTimeout) || 0}s`,
  expose_exporter: exposeExporter,
  log_level: logLevel,
  metrics_mode: metricsMode,
});

export const exporterMetricsState = (exporter: ServiceAgent) => ({
  ...toMetricsSettings(exporter),
  status: exporter.status,
});

// The exporters take the level in lower case, as --log.level=debug or valkey_exporter's --log-level=debug.
export const logLevelFlag = (logLevel: LogLevel) =>
  new RegExp(`log[.-]level=${logLevel.replace('LOG_LEVEL_', '').toLowerCase()}\\b`, 'i');
