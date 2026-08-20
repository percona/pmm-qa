export enum ServiceType {
  external = 'SERVICE_TYPE_EXTERNAL_SERVICE',
  haproxy = 'SERVICE_TYPE_HAPROXY_SERVICE',
  mongodb = 'SERVICE_TYPE_MONGODB_SERVICE',
  mysql = 'SERVICE_TYPE_MYSQL_SERVICE',
  postgresql = 'SERVICE_TYPE_POSTGRESQL_SERVICE',
  proxysql = 'SERVICE_TYPE_PROXYSQL_SERVICE',
  unspecified = 'SERVICE_TYPE_UNSPECIFIED',
  valkey = 'SERVICE_TYPE_VALKEY_SERVICE',
}

export enum AgentStatus {
  done = 'AGENT_STATUS_DONE',
  running = 'AGENT_STATUS_RUNNING',
  starting = 'AGENT_STATUS_STARTING',
  stopping = 'AGENT_STATUS_STOPPING',
  unknown = 'AGENT_STATUS_UNKNOWN',
  unspecified = 'AGENT_STATUS_UNSPECIFIED',
  waiting = 'AGENT_STATUS_WAITING',
}

export enum CliAgentStatus {
  done = 'DONE',
  running = 'RUNNING',
  starting = 'STARTING',
  stopping = 'STOPPING',
  unknown = 'UNKNOWN',
  unspecified = 'UNSPECIFIED',
  waiting = 'WAITING',
}

export enum AgentType {
  postgresExporter = 'AGENT_TYPE_POSTGRES_EXPORTER',
  qanPgStatMonitor = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATMONITOR_AGENT',
  qanPgStatStatements = 'AGENT_TYPE_QAN_POSTGRESQL_PGSTATEMENTS_AGENT',
}

// Display names shown in the PMM Inventory Agents grid.
export enum AgentName {
  postgresqlExporter = 'PostgreSQL exporter',
  qanPgStatMonitor = 'QAN PostgreSQL pg_stat_monitor agent',
  qanPgStatStatements = 'QAN PostgreSQL pg_stat_statements agent',
}

// Log level values returned by the inventory agents API.
export enum LogLevel {
  debug = 'LOG_LEVEL_DEBUG',
  error = 'LOG_LEVEL_ERROR',
  info = 'LOG_LEVEL_INFO',
  warn = 'LOG_LEVEL_WARN',
}
