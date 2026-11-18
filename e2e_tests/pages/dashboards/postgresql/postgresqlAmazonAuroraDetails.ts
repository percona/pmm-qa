import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlAmazonAuroraDetails implements DashboardInterface {
  url = 'graph/d/postgresql-amazonaurora/postgresql-amazon-aurora-details';
  metrics: GrafanaPanel[] = [
    { name: 'Transaction Commits', type: 'timeSeries' },
    { name: 'Commit Latency', type: 'timeSeries' },
    { name: 'Statement Throughput', type: 'timeSeries' },
    { name: 'Statement Latency', type: 'timeSeries' },
    { name: 'Problems', type: 'timeSeries' },
    { name: 'Oldest Transaction ID Age', type: 'timeSeries' },
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
    { name: 'Replica Lag', type: 'timeSeries' },
    { name: 'Aurora Replica Lag (CloudWatch)', type: 'timeSeries' },
  ];
  // The test cluster has no reader instance.
  noDataMetrics: string[] = ['Replica Lag', 'Aurora Replica Lag (CloudWatch)'];
}
