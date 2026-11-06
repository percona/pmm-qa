import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlAmazonAuroraDetails implements DashboardInterface {
  url = 'graph/d/mysql-amazonaurora/mysql-amazon-aurora-details';
  metrics: GrafanaPanel[] = [
    { name: 'Amazon Aurora Transaction Commits', type: 'timeSeries' },
    { name: 'Amazon Aurora Load', type: 'timeSeries' },
    { name: 'Aurora Memory Used', type: 'timeSeries' },
    { name: 'Amazon Aurora Statement Latency', type: 'timeSeries' },
    { name: 'Amazon Aurora Special Command Counters', type: 'timeSeries' },
    { name: 'Amazon Aurora Problems', type: 'timeSeries' },
    { name: 'Buffer Cache Hit Ratio', type: 'timeSeries' },
    { name: 'Free Local Storage', type: 'timeSeries' },
    { name: 'Cluster volume used', type: 'timeSeries' },
    { name: 'CPU utilization', type: 'timeSeries' },
    { name: 'Freeable memory', type: 'timeSeries' },
    { name: 'Database connections', type: 'timeSeries' },
    { name: 'IOPS', type: 'timeSeries' },
    { name: 'Throughput', type: 'timeSeries' },
    { name: 'Network throughput', type: 'timeSeries' },
    { name: 'Disk queue depth', type: 'timeSeries' },
    { name: 'Swap usage', type: 'timeSeries' },
    { name: 'Aurora Replica Lag', type: 'timeSeries' },
    { name: 'Aurora Binlog Replica Lag', type: 'timeSeries' },
    { name: 'Forwarded Write Statements', type: 'timeSeries' },
    { name: 'Forwarding Open Sessions', type: 'timeSeries' },
    { name: 'Parallel Query Requests', type: 'timeSeries' },
    { name: 'Serverless Capacity', type: 'timeSeries' },
  ];
  // The test cluster has no reader instance.
  noDataMetrics: string[] = ['Aurora Replica Lag'];
}
