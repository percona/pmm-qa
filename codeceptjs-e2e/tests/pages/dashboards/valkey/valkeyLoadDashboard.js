class ValkeyLoadDashboard {
  constructor() {
    this.url = 'graph/d/valkey-load/valkey-redis-load';
    this.metrics = [
      'All - Total Commands/Sec',
      'valkey-primary-1-svc-* - Read and Write Rate',
      'valkey-primary-2-svc-* - Read and Write Rate',
      'valkey-primary-3-svc-* - Read and Write Rate',
      'valkey-replica-4-svc-* - Read and Write Rate',
      'valkey-replica-5-svc-* - Read and Write Rate',
      'valkey-replica-6-svc-* - Read and Write Rate',
      'valkey-primary-1-node-* - Commands by Type',
      'valkey-primary-2-node-* - Commands by Type',
      'valkey-primary-3-node-* - Commands by Type',
      'valkey-replica-4-node-* - Commands by Type',
      'valkey-replica-5-node-* - Commands by Type',
      'valkey-replica-6-node-* - Commands by Type',
      'All - Hits/Misses per Sec',
      'IO thread Operations',
      'IO Threads Configured',
      'IO Threads Active',
    ];
  }
}

module.exports = new ValkeyLoadDashboard();
module.exports.ValkeyLoadDashboard = ValkeyLoadDashboard;
