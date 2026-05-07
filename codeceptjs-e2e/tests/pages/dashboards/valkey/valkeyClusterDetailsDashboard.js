class ValkeyClusterDetailsDashboard {
  constructor() {
    this.url = 'graph/d/valkey-cluster-details/valkey-redis-cluster-details';
    this.metrics = [
      'slots status',
      'All - cluster state',
      'cluster messages',
      'All - cluster connections',
      'All - known nodes',
      'valkey-primary-1-svc',
      'valkey-primary-2-svc',
      'valkey-primary-3-svc',
      'valkey-replica-4-svc',
      'valkey-replica-5-svc',
      'valkey-replica-6-svc',
      'All - Replica vs Master offsets',
      'Replicas',
      'Connected Replicas',
      'Full resyncs',
      'Partial resyncs',
      'Backlog Size',
      'Backlog first byte offset',
      'Backlog History Bytes',
      'Replica Resync Info',
    ];
  }
}

module.exports = new ValkeyClusterDetailsDashboard();
module.exports.ValkeyClusterDetailsDashboard = ValkeyClusterDetailsDashboard;
