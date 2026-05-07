class ValkeyLoadDashboard {
  constructor() {
    this.url = 'graph/d/valkey-load/valkey-redis-load';
    this.metrics = [
      'All - Total Commands / sec',
      'valkey-primary-1-svc-* - Read and Write rate',
      'valkey-primary-2-svc-* - Read and Write rate',
      'valkey-primary-3-svc-* - Read and Write rate',
      'valkey-replica-4-svc-* - Read and Write rate',
      'valkey-replica-5-svc-* - Read and Write rate',
      'valkey-replica-6-svc-* - Read and Write rate',
      'valkey-primary-1-node-* - command ops/sec',
      'valkey-primary-2-node-* - command ops/sec',
      'valkey-primary-3-node-* - command ops/sec',
      'valkey-replica-4-node-* - command ops/sec',
      'valkey-replica-5-node-* - command ops/sec',
      'valkey-replica-6-node-* - command ops/sec',
      'All - Hits / Misses per Sec',
      'IO thread R/W per Sec',
      'IO threads configured',
      'IO threads active',
    ];
  }
}

module.exports = new ValkeyLoadDashboard();
module.exports.ValkeyLoadDashboard = ValkeyLoadDashboard;
