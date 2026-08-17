import DashboardInterface, { MetricsRow } from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbReplSetSummary implements DashboardInterface {
  url = 'graph/d/mongodb-replicaset-summary/mongodb-replset-summary';
  noDataMetrics: string[] = [];

  metrics = (services: string[], nodes: string[]): MetricsRow[] => [
    { metrics: [{ name: 'Members', type: 'polyStat' }], rowName: 'Current Topology' },
    {
      metrics: [
        { name: 'Feature Compatibility Version', type: 'stat' },
        { name: 'Members', type: 'stat' },
        { name: 'DBs', type: 'stat' },
        { name: 'Last Election', type: 'stat' },
        { name: 'Total Data Size', type: 'stat' },
        { name: 'Data Size Over Time', type: 'timeSeries' },
      ],
      rowName: 'Overview',
    },
    ...services.map(
      (serviceName): MetricsRow => ({
        metrics: [
          { name: 'State', type: 'stat' },
          { name: 'CPU Usage', type: 'gauge' },
          { name: 'Memory Used', type: 'gauge' },
          { name: 'Disk IO Utilization', type: 'gauge' },
          { name: 'Disk Space Utilization', type: 'gauge' },
          { name: 'Disk IOPS', type: 'stat' },
          { name: 'Network Traffic', type: 'stat' },
          { name: 'Uptime', type: 'stat' },
          { name: 'Version', type: 'stat' },
        ],
        rowName: `Overview - ${serviceName}`,
      }),
    ),
    {
      metrics: [
        { name: 'Command Operations', type: 'timeSeries' },
        { name: 'Top Hottest Collections by Read', type: 'barGauge' },
        { name: 'Operation Latencies', type: 'timeSeries' },
        { name: 'Top Hottest Collections by Write', type: 'barGauge' },
        { name: 'Query Efficiency', type: 'timeSeries' },
        { name: 'Queued Operations', type: 'timeSeries' },
        { name: 'Reads & Writes', type: 'timeSeries' },
        { name: 'Average Connections', type: 'timeSeries' },
      ],
      rowName: 'Details',
    },
    {
      metrics: [
        { name: 'Number of Collections', type: 'table' },
        { name: 'Size of Collections', type: 'table' },
        { name: 'Fragmentation Analysis', type: 'table' },
        { name: 'Count of Documents', type: 'table' },
      ],
      rowName: 'Collection Details',
    },
    {
      metrics: [
        ...services.map(
          (serviceName): GrafanaPanel => ({ name: `Oplog GB/Hour - ${serviceName}`, type: 'timeSeries' }),
        ),
        { name: 'Replication Lag', type: 'timeSeries' },
        { name: 'Oplog Recovery Window', type: 'timeSeries' },
        { name: 'Flow Control', type: 'timeSeries' },
      ],
      rowName: 'Replication',
    },
    { metrics: [{ name: 'Member States', type: 'stateTime' }], rowName: 'States - All' },
    { metrics: [{ name: 'Nodes Overview', type: 'table' }], rowName: 'Nodes Summary' },
    {
      metrics: [
        ...nodes.map(
          (serviceName): GrafanaPanel => ({ name: `CPU Usage - ${serviceName}`, type: 'timeSeries' }),
        ),
      ],
      rowName: 'CPU Usage',
    },
    {
      metrics: [
        ...nodes.map(
          (serviceName): GrafanaPanel => ({
            name: `CPU Saturation and Max Core Usage - ${serviceName}`,
            type: 'timeSeries',
          }),
        ),
      ],
      rowName: 'CPU Saturation',
    },

    {
      metrics: [
        ...nodes.map(
          (serviceName): GrafanaPanel => ({
            name: `Disk I/O and Swap Activity - ${serviceName}`,
            type: 'timeSeries',
          }),
        ),
      ],
      rowName: 'Disk I/O and Swap Activity',
    },
    {
      metrics: [
        ...nodes.map(
          (serviceName): GrafanaPanel => ({
            name: `Network Traffic - ${serviceName}`,
            type: 'timeSeries',
          }),
        ),
      ],
      rowName: 'Network Traffic',
    },
  ];

  metricsWithDataForRow = (rowName: string, serviceNames: string[], nodeName: string[]): GrafanaPanel[] =>
    this.metrics(serviceNames, nodeName).filter((metrics) => metrics.rowName === rowName)[0].metrics;
}
