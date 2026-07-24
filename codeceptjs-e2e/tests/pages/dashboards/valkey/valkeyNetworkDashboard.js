class ValkeyNetworkDashboard {
  constructor() {
    this.url = 'graph/d/valkey-network/valkey-redis-network';
    this.metrics = [
      'valkey-primary-1-svc-* - Network Input',
      'valkey-primary-2-svc-* - Network Input',
      'valkey-primary-3-svc-* - Network Input',
      'valkey-replica-4-svc-* - Network Input',
      'valkey-replica-5-svc-* - Network Input',
      'valkey-replica-6-svc-* - Network Input',
      'valkey-primary-1-svc-* - Network Output',
      'valkey-primary-2-svc-* - Network Output',
      'valkey-primary-3-svc-* - Network Output',
      'valkey-replica-4-svc-* - Network Output',
      'valkey-replica-5-svc-* - Network Output',
      'valkey-replica-6-svc-* - Network Output',
    ];
  }
}

module.exports = new ValkeyNetworkDashboard();
module.exports.ValkeyNetworkDashboard = ValkeyNetworkDashboard;
