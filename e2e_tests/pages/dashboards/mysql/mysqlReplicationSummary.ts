import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlReplicationSummary implements DashboardInterface {
  url = 'graph/d/mysql-replicaset-summary/mysql-replication-summary';
  noDataMetrics: string[] = [
    'Replication error no',
    'Binlog data written hourly',
    'Binlogs created hourly',
    'Relay log written hourly',
  ];

  metrics = (serviceName: string): GrafanaPanel[] => [
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
    { name: `MySQL connections - ${serviceName}`, type: 'timeSeries' },
    { name: `MySQL client thread activity - ${serviceName}`, type: 'timeSeries' },
    { name: `MySQL handlers - ${serviceName}`, type: 'timeSeries' },
    { name: `Top command counters - ${serviceName}`, type: 'timeSeries' },
    { name: `Process states - ${serviceName}`, type: 'timeSeries' },
    { name: `MySQL network traffic  - ${serviceName}`, type: 'timeSeries' },
    { name: 'System uptime', type: 'stat' },
    { name: 'Load average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory available', type: 'stat' },
    { name: 'Virtual memory', type: 'stat' },
    { name: 'Disk space', type: 'stat' },
    { name: 'Min space available', type: 'stat' },
    { name: 'Node', type: 'text' },
    { name: `CPU usage - ${serviceName}`, type: 'timeSeries' },
    { name: `CPU saturation and max core usage - ${serviceName}`, type: 'timeSeries' },
    { name: `Disk I/O and swap activity -  - ${serviceName}`, type: 'timeSeries' },
    { name: `Network traffic -  - ${serviceName}`, type: 'timeSeries' },
  ];

  metricsWithData = (serviceName: string) =>
    this.metrics(serviceName).filter((metric) => !this.noDataMetrics.includes(metric.name));
}
