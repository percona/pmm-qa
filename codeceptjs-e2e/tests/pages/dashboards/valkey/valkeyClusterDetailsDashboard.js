class ValkeyClusterDetailsDashboard {
  constructor() {
    this.url = 'graph/d/valkey-cluster-details/valkey-redis-cluster-details';
    this.metrics = [
      'Slots Status',
      'All - Cluster State',
      'Cluster Messages',
      'All - Cluster Connections',
      'All - Known Nodes',
      'valkey-primary-1-svc-*',
      'valkey-primary-2-svc-*',
      'valkey-primary-3-svc-*',
      'valkey-replica-4-svc-*',
      'valkey-replica-5-svc-*',
      'valkey-replica-6-svc-*',
      'All - Replica vs Master offsets',
      'Replicas',
      'Connected Replicas',
      'Full Resyncs',
      'Partial Resyncs',
      'Backlog Size',
      'Backlog First Byte Offset',
      'Backlog History Bytes',
      'Replica Resync Info',
    ];
  }
}

module.exports = new ValkeyClusterDetailsDashboard();
module.exports.ValkeyClusterDetailsDashboard = ValkeyClusterDetailsDashboard;
