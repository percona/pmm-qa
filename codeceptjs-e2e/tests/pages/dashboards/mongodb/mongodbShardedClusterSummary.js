class MongodbShardedClusterSummary {
  constructor() {
    this.url = 'graph/d/mongodb-cluster-summary/mongodb-sharded-cluster-summary';
    this.metrics = [
      'QPS of Services',
      'Feature Compatibility Version',
      'Shards',
      'Mongos',
      'Draining Shards',
      'DBs',
      'Balancer Enabled',
      'Chunks',
      'Last Election',
      'Data distribution',
      'Command Operations',
      'Top Hottest Collections by Read',
      'Operation Latencies',
      'Top Hottest Collections by Write',
      'Operations Per Shard',
      'MongoDB Versions',
      'Config Servers',
      'Mongos Routers',
      'Shard - rs1',
      'Shard - rs2',
      'rs1 Node States',
      'rs2 Node States',
      'rscfg Node States',
      'Current Connections Per Shard',
      'Available Connections',
      'Number of Collections in Shards',
      'Size of Collections in Shards',
      'Count of Documents in Shards',
      'Chunk distribution',
      'Amount of Chunks in Shards',
      'Dynamic of Chunks',
      'Chunks Move Events',
      'Chunks Split Events',
      'Replication Lag by Shard',
      'Oplog Range by Shard',
      'Flow Control',
      'Oplog GB/Hour',
    ];
  }
}

module.exports = new MongodbShardedClusterSummary();
module.exports.MongodbShardedClusterSummary = MongodbShardedClusterSummary;
