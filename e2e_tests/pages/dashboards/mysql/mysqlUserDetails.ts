import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MySQLUserDetails implements DashboardInterface {
  constructor() {}

  url = 'graph/d/mysql-user/mysql-user-details';
  metrics: GrafanaPanel[] = [
    { name: ' ', type: 'empty' },
    { name: 'Active Users', type: 'stat' },
    { name: 'Lost Connections', type: 'stat' },
    { name: 'Denied Connections', type: 'stat' },
    { name: 'Access Denied', type: 'stat' },
    { name: 'Top 10 Sessions', type: 'barGauge' },
    { name: 'Users Activity', type: 'stat' },
    { name: 'Users by Connections Created', type: 'timeSeries' },
    { name: 'Users by Concurrent Connections', type: 'timeSeries' },
    { name: 'Users by Lost Connections', type: 'timeSeries' },
    { name: 'Top Users by Denied Connections', type: 'timeSeries' },
    { name: 'Users by Busy Load', type: 'timeSeries' },
    { name: 'Users by CPU Time', type: 'timeSeries' },
    { name: 'Users by Traffic', type: 'timeSeries' },
    { name: 'Users by Bytes Written to The Binary Log', type: 'timeSeries' },
    { name: 'Rows Fetched', type: 'table' },
    { name: 'Rows Read', type: 'table' },
    { name: 'Rows Updated', type: 'table' },
    { name: 'Users by Rows Fetched/Read', type: 'timeSeries' },
    { name: 'Users by Rows Updated', type: 'timeSeries' },
    { name: 'Users by Rollback Transactions', type: 'timeSeries' },
    { name: 'Users by Commit Transactions', type: 'timeSeries' },
    { name: 'Users by Update Commands', type: 'timeSeries' },
    { name: 'Users by Select Commands', type: 'timeSeries' },
    { name: 'Users by Other Commands', type: 'timeSeries' },
    { name: 'Users by Access Denied', type: 'timeSeries' },
    { name: 'Users by Empty Queries', type: 'timeSeries' },
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

  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
