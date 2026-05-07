class ValkeyReplicationDashboard {
  constructor() {
    this.url = 'graph/d/valkey-replication/valkey-redis-replication';
    this.metrics = [
      'valkey-primary-1-svc',
      'valkey-primary-2-svc',
      'valkey-primary-3-svc',
      'valkey-replica-4-svc',
      'valkey-replica-5-svc',
      'valkey-replica-6-svc',
      'valkey-replica-4-svc-* - Replica vs Master offsets',
      'valkey-replica-5-svc-* - Replica vs Master offsets',
      'valkey-replica-6-svc-* - Replica vs Master offsets',
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

module.exports = new ValkeyReplicationDashboard();
module.exports.ValkeyReplicationDashboard = ValkeyReplicationDashboard;
