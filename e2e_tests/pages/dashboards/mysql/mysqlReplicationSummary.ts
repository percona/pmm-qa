import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlReplicationSummary implements DashboardInterface {
  url = 'graph/d/mysql-replicaset-summary/mysql-replication-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Node', type: 'stat' },
    { name: 'IO Thread Running', type: 'stat' },
    { name: 'SQL Thread Running', type: 'stat' },
    { name: 'Replication Error No', type: 'unknown' },
    { name: 'Read Only', type: 'stat' },
    { name: 'Replication Delay', type: 'stat' },
    { name: 'MySQL Replication Lag', type: 'timeSeries' },
    { name: 'Binlogs Size', type: 'stat' },
    { name: 'Binlog Data Written Hourly', type: 'unknown' },
    { name: 'Binlogs Count', type: 'stat' },
    { name: 'Binlogs Created Hourly', type: 'unknown' },
    { name: 'Relay Log Space', type: 'stat' },
    { name: 'Relay Log Written Hourly', type: 'unknown' },
    { name: 'MySQL Uptime', type: 'stat' },
    { name: 'Version', type: 'text' },
    { name: 'Current QPS', type: 'stat' },
    { name: 'File Handlers Used', type: 'stat' },
    { name: 'Table Open Cache Miss Ratio', type: 'stat' },
    { name: 'Table Open Cache Size', type: 'stat' },
    { name: 'Table Definition Cache Size', type: 'stat' },
    { name: 'Service', type: 'text' },
    { name: 'MySQL Connections', type: 'timeSeries' },
    { name: 'MySQL Client Thread Activity', type: 'timeSeries' },
    { name: 'MySQL Handlers', type: 'timeSeries' },
    { name: 'Top Command Counters', type: 'timeSeries' },
    { name: 'Process States', type: 'timeSeries' },
    { name: 'MySQL Network Traffic', type: 'timeSeries' },
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
  noDataMetrics: string[] = [
    'Replication Error No',
    'Binlog Data Written Hourly',
    'Binlogs Created Hourly',
    'Relay Log Written Hourly',
  ];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
