import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PXCGaleraClusterSummary {
  constructor() {}

  url = 'graph/d/pxc-cluster-summary/pxc-galera-cluster-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Percona XtraDB / Galera Cluster Size', type: 'unknown' },
    { name: 'Flow Control Paused Time', type: 'timeSeries' },
    { name: 'Flow Control Messages Sent', type: 'timeSeries' },
    { name: 'Writeset Inbound Traffic', type: 'timeSeries' },
    { name: 'Writeset Outbound Traffic', type: 'timeSeries' },
    { name: 'Receive Queue', type: 'timeSeries' },
    { name: 'Send Queue', type: 'timeSeries' },
    { name: 'Transactions Received', type: 'timeSeries' },
    { name: 'Transactions Replicated', type: 'timeSeries' },
    { name: 'Average Incoming Transaction Size', type: 'timeSeries' },
    { name: 'Average Replicated Transaction Size', type: 'timeSeries' },
    { name: 'FC Trigger Low Limit', type: 'timeSeries' },
    { name: 'FC Trigger High Limit', type: 'timeSeries' },
    { name: 'IST Progress', type: 'timeSeries' },
    { name: 'Average Galera Replication Latency', type: 'timeSeries' },
    { name: 'Maximum Galera Replication Latency', type: 'timeSeries' },
  ];

  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
