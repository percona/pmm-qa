class ValkeyMemoryDashboard {
  constructor() {
    this.url = 'graph/d/valkey-memory/valkey-redis-memory';
    this.metrics = [
      'Memory Usage',
      'Eviction Policy',
      'Number of Keys',
      'Total Memory Usage',
      'Expired/Evicted Keys',
      'Expiring vs Not-Expiring Keys',
    ];
  }
}

module.exports = new ValkeyMemoryDashboard();
module.exports.ValkeyMemoryDashboard = ValkeyMemoryDashboard;
