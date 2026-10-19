import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlInstanceSummary implements DashboardInterface {
  url = 'graph/d/postgresql-instance-summary/postgresql-instance-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Service', type: 'text' },
    { name: 'Connections', type: 'text' },
    { name: 'Slow queries', type: 'text' },
    { name: 'Connections per Database', type: 'pie' },
    { name: 'QPS', type: 'timeSeries' },
    { name: 'Number of Locks', type: 'timeSeries' },
    { name: 'Tuples', type: 'barGauge' },
    { name: 'Queries', type: 'table' },
    { name: 'Oldest Autovacuum', type: 'stat' },
    { name: 'Dead Tuples %', type: 'timeSeries' },
    { name: 'Transaction Wraparound', type: 'timeSeries' },
    { name: 'CPU', type: 'timeSeries' },
    { name: 'Disk IO Latency', type: 'timeSeries' },
    { name: 'Top 10 Biggest Databases', type: 'table' },
    { name: 'Service Summary', type: 'summary' },
    { name: 'Tuples', type: 'timeSeries' },
    { name: 'Read Tuple Activity', type: 'timeSeries' },
    { name: 'Tuples Changes by Queries', type: 'timeSeries' },
    { name: 'Transactions', type: 'timeSeries' },
    { name: 'Duration of Transactions', type: 'timeSeries' },
    { name: 'Number of Temp Files', type: 'timeSeries' },
    { name: 'Size of Temp Files', type: 'timeSeries' },
    { name: 'Temp Files Activity', type: 'timeSeries' },
    { name: 'Temp Files Utilization', type: 'timeSeries' },
    { name: 'Conflicts/Deadlocks', type: 'timeSeries' },
    { name: 'Number of Locks', type: 'timeSeries' },
    { name: 'PostgreSQL Settings', type: 'text' },
    { name: 'System Uptime', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'Node', type: 'text' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Disk I/O and Swap Activity', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
}
