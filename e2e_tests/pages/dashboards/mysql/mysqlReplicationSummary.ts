import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlReplicationSummary implements DashboardInterface {
  url = 'graph/d/mysql-replicaset-summary/mysql-replication-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Node', type: 'stat' },
    { name: 'IO thread running', type: 'stat' },
    { name: 'SQL thread running', type: 'stat' },
    { name: 'Replication error no', type: 'unknown' },
    { name: 'Read only', type: 'stat' },
    { name: 'Replication delay', type: 'stat' },
    { name: 'MySQL replication lag', type: 'timeSeries' },
    { name: 'Binlogs size', type: 'stat' },
    { name: 'Binlog data written hourly', type: 'unknown' },
    { name: 'Binlogs count', type: 'stat' },
    { name: 'Binlogs created hourly', type: 'unknown' },
    { name: 'Relay log space', type: 'stat' },
    { name: 'Relay log written hourly', type: 'unknown' },
    { name: 'MySQL uptime', type: 'stat' },
    { name: 'Version', type: 'text' },
    { name: 'Current QPS', type: 'stat' },
    { name: 'File handlers used', type: 'stat' },
    { name: 'Table open cache miss ratio', type: 'stat' },
    { name: 'Table open cache size', type: 'stat' },
    { name: 'Table definition cache size', type: 'stat' },
    { name: 'Service', type: 'text' },
    { name: 'MySQL connections - *', type: 'timeSeries' },
    { name: 'MySQL client thread activity - *', type: 'timeSeries' },
    { name: 'MySQL handlers - *', type: 'timeSeries' },
    { name: 'Top command counters - *', type: 'timeSeries' },
    { name: 'Process states - *', type: 'timeSeries' },
    { name: 'MySQL network traffic  - *', type: 'timeSeries' },
    { name: 'System uptime', type: 'stat' },
    { name: 'Load average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory available', type: 'stat' },
    { name: 'Virtual memory', type: 'stat' },
    { name: 'Disk space', type: 'stat' },
    { name: 'Min space available', type: 'stat' },
    { name: 'Node', type: 'text' },
    { name: 'CPU usage - *', type: 'timeSeries' },
    { name: 'CPU saturation and max core usage - *', type: 'timeSeries' },
    { name: 'Disk I/O and swap activity -  - *', type: 'timeSeries' },
    { name: 'Network traffic -  - *', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [
    'Replication error no',
    'Binlog data written hourly',
    'Binlogs created hourly',
    'Relay log written hourly',
  ];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
