import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlGroupReplicationSummary implements DashboardInterface {
  constructor() {}

  url = 'graph/d/mysql-group-replicaset-summary/mysql-group-replication-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Group Replication Service States', type: 'stateTime' },
    { name: 'PRIMARY Service', type: 'stateTime' },
    { name: 'Replication Group Members', type: 'table' },
    { name: 'Replication Lag', type: 'timeSeries' },
    { name: 'Transport Time', type: 'timeSeries' },
    { name: 'Replication Delay', type: 'timeSeries' },
    { name: 'Transaction Apply Time', type: 'timeSeries' },
    { name: 'Transaction Time Inside the Local Queue', type: 'timeSeries' },
    { name: 'Checked Transactions', type: 'timeSeries' },
    { name: 'Transactions Row Validating', type: 'timeSeries' },
    { name: 'Applied Transactions ', type: 'timeSeries' },
    { name: 'Sent Transactions ', type: 'timeSeries' },
    { name: 'Received Transactions Queue', type: 'timeSeries' },
    { name: 'Rolled Back Transactions ', type: 'timeSeries' },
    { name: 'Transactions in the Queue for Checking', type: 'timeSeries' },
    { name: 'Detected Conflicts', type: 'timeSeries' },
  ];

  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
