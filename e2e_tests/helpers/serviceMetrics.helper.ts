import { FrameworkService, frameworkServices } from '@helpers/frameworkServices.helper';
import { ServiceAgent } from '@interfaces/inventory';

export type MetricsMode = 'METRICS_MODE_PULL' | 'METRICS_MODE_PUSH';

export const logLevelLabels = {
  LOG_LEVEL_DEBUG: 'Debug',
  LOG_LEVEL_ERROR: 'Error',
  LOG_LEVEL_FATAL: 'Fatal',
  LOG_LEVEL_INFO: 'Info',
  LOG_LEVEL_UNSPECIFIED: 'Default',
  LOG_LEVEL_WARN: 'Warning',
};

export type LogLevel = keyof typeof logLevelLabels;

export interface ServiceMetricsSettings {
  // Seconds as the form shows them, blank for the default.
  connectionTimeout: string;
  exposeExporter: boolean;
  logLevel: LogLevel;
  metricsMode: MetricsMode;
}

interface ServiceMetrics extends FrameworkService {
  // mysqld_exporter, postgres_exporter and valkey_exporter have no fatal level, so the form leaves it out.
  fatalLogLevel: boolean;
  upMetric: string;
}

export const serviceMetricsSettings: ServiceMetrics[] = [
  {
    ...frameworkServices.pdpgsql,
    fatalLogLevel: false,
    upMetric: 'pg_up',
  },
  {
    ...frameworkServices.ps,
    fatalLogLevel: false,
    upMetric: 'mysql_up',
  },
  {
    ...frameworkServices.psmdb,
    fatalLogLevel: true,
    upMetric: 'mongodb_up',
  },
  {
    ...frameworkServices.valkey,
    fatalLogLevel: false,
    upMetric: 'redis_up',
  },
  {
    ...frameworkServices.proxysql,
    fatalLogLevel: true,
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
