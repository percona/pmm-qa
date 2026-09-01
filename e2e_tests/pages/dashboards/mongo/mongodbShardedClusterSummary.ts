import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MongodbShardedClusterSummary implements DashboardInterface {
  url = 'graph/d/mongodb-cluster-summary/mongodb-sharded-cluster-summary';

  metrics = (shardNames: string[] = [], nodeNames: string[] = [], serviceNames: string[]): GrafanaPanel[] => [
    { name: 'Config Servers', type: 'polyStat' },
    { name: 'Mongos Routers', type: 'polyStat' },
    ...shardNames.map((name): GrafanaPanel => ({ name: `Shard - ${name}`, type: 'polyStat' })),
    { name: 'QPS of Services', type: 'gauge' },
    { name: 'Feature Compatibility Version', type: 'stat' },
    { name: 'Shards', type: 'stat' },
    { name: 'Mongos', type: 'stat' },
    { name: 'Draining Shards', type: 'stat' },
    { name: 'DBs', type: 'stat' },
    { name: 'Balancer Enabled', type: 'stat' },
    { name: 'Chunks', type: 'stat' },
    { name: 'Last Election', type: 'stat' },
    { name: 'Data distribution', type: 'barGauge' },
    { name: 'Command Operations', type: 'timeSeries' },
    { name: 'Top Hottest Collections by Read', type: 'barGauge' },
    { name: 'Operation Latencies', type: 'timeSeries' },
    { name: 'Top Hottest Collections by Write', type: 'barGauge' },
    { name: 'Operations Per Shard', type: 'timeSeries' },
    { name: 'MongoDB Versions', type: 'table' },
    ...nodeNames.map((name): GrafanaPanel => ({ name: `${name} Node States`, type: 'stateTime' })),
    { name: 'Current Connections Per Shard', type: 'timeSeries' },
    { name: 'Available Connections', type: 'timeSeries' },
    { name: 'Number of Collections in Shards', type: 'table' },
    { name: 'Size of Collections in Shards', type: 'table' },
    { name: 'Fragmentation Analysis', type: 'table' },
    { name: 'Count of Documents in Shards', type: 'table' },
    { name: 'Chunk distribution', type: 'barGauge' },
    { name: 'Amount of Chunks in Shards', type: 'table' },
    { name: 'Dynamic of Chunks', type: 'timeSeries' },
    { name: 'Chunks Move Events', type: 'timeSeries' },
    { name: 'Chunks Split Events', type: 'timeSeries' },
    { name: 'Replication Lag by Shard', type: 'timeSeries' },
    { name: 'Oplog Range by Shard', type: 'timeSeries' },
    { name: 'Flow Control', type: 'timeSeries' },
    ...serviceNames.map((name): GrafanaPanel => ({ name: `Oplog GB/Hour - ${name}`, type: 'timeSeries' })),
    { name: 'Nodes Overview', type: 'table' },
  ];

  metricsWithData = (shardNames: string[] = [], nodeNames: string[] = [], serviceNames: string[] = []) =>
    this.metrics(shardNames, nodeNames, serviceNames).filter(
      (metric) => !this.noDataMetrics(shardNames, nodeNames, serviceNames).includes(metric.name),
    );

  noDataMetrics = (serviceNames: string[]): string[] => [
    ...serviceNames.map((name): string => `Oplog GB/Hour - ${name}`),
  ];
}
