import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MysqlInstanceSummary {
  constructor() {}

  url = 'graph/d/mysql-instance-summary/mysql-instance-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Node', type: 'text' },
    { name: 'MySQL Uptime', type: 'stat' },
    { name: 'Version', type: 'text' },
    { name: 'Current QPS', type: 'stat' },
    { name: 'InnoDB Buffer Pool Size', type: 'stat' },
    { name: 'Buffer Pool Size of Total RAM', type: 'stat' },
    { name: 'Service Summary', type: 'summary' },
    { name: 'MySQL Connections', type: 'timeSeries' },
    { name: 'MySQL Aborted Connections', type: 'timeSeries' },
    { name: 'MySQL Client Thread Activity', type: 'timeSeries' },
    { name: 'MySQL Thread Cache', type: 'timeSeries' },
    { name: 'MySQL Temporary Objects', type: 'timeSeries' },
    { name: 'MySQL Slow Queries', type: 'timeSeries' },
    { name: 'MySQL Select Types', type: 'timeSeries' },
    { name: 'MySQL Sorts', type: 'timeSeries' },
    { name: 'MySQL Table Locks', type: 'timeSeries' },
    { name: 'MySQL Questions', type: 'timeSeries' },
    { name: 'MySQL Network Traffic', type: 'timeSeries' },
    { name: 'MySQL Network Usage Hourly', type: 'timeSeries' },
    { name: 'MySQL Internal Memory Overview', type: 'timeSeries' },
    { name: 'Top Command Counters', type: 'timeSeries' },
    { name: 'Top Command Counters Hourly', type: 'timeSeries' },
    { name: 'MySQL Handlers', type: 'timeSeries' },
    { name: 'MySQL Transaction Handlers', type: 'timeSeries' },
    { name: 'Process States', type: 'timeSeries' },
    { name: 'Top Process States Hourly', type: 'timeSeries' },
    { name: 'MySQL Query Cache Memory', type: 'timeSeries' },
    { name: 'MySQL Query Cache Activity', type: 'timeSeries' },
    { name: 'MySQL File Openings', type: 'timeSeries' },
    { name: 'MySQL Open Files', type: 'timeSeries' },
    { name: 'MySQL Table Open Cache Status', type: 'timeSeries' },
    { name: 'MySQL Open Tables', type: 'timeSeries' },
    { name: 'MySQL Table Definition Cache', type: 'timeSeries' },
    { name: 'System Uptime', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Disk I/O and Swap Activity', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [
    'Top Process States Hourly',
    'Top Command Counters Hourly',
    'MySQL Network Usage Hourly',
    'Buffer Pool Size of Total RAM',
    'MySQL Query Cache Memory',
    'MySQL Query Cache Activity',
  ];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
