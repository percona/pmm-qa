class ValkeyReplicationDashboard {
  constructor() {
    this.url = 'graph/d/valkey-replication/valkey-redis-replication';
    this.metrics = [
      'valkey-primary-1-svc-*',
      'valkey-primary-2-svc-*',
      'valkey-primary-3-svc-*',
      'valkey-replica-4-svc-*',
      'valkey-replica-5-svc-*',
      'valkey-replica-6-svc-*',
      'All - Replica vs Master Offsets',
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

module.exports = new ValkeyReplicationDashboard();
module.exports.ValkeyReplicationDashboard = ValkeyReplicationDashboard;
