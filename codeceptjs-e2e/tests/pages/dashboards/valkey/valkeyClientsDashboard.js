class ValkeyClientsDashboard {
  constructor() {
    this.url = 'graph/d/valkey-clients/valkey-redis-clients';
    this.metrics = [
      'valkey-primary-1-svc-* - Connected/Blocked Clients',
      'valkey-primary-2-svc-* - Connected/Blocked Clients',
      'valkey-primary-3-svc-* - Connected/Blocked Clients',
      'valkey-replica-4-svc-* - Connected/Blocked Clients',
      'valkey-replica-5-svc-* - Connected/Blocked Clients',
      'valkey-replica-6-svc-* - Connected/Blocked Clients',
      'Config Max Clients',
      'Evicted Clients',
      'valkey-primary-1-svc-* - client Buffers',
      'valkey-primary-2-svc-* - client Buffers',
      'valkey-primary-3-svc-* - client Buffers',
      'valkey-replica-4-svc-* - client Buffers',
      'valkey-replica-5-svc-* - client Buffers',
      'valkey-replica-6-svc-* - client Buffers',
    ];
  }
}

module.exports = new ValkeyClientsDashboard();
module.exports.ValkeyClientsDashboard = ValkeyClientsDashboard;
