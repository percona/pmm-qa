class ValkeyPersistenceDetailsDashboard {
  constructor() {
    this.url = 'graph/d/valkey-persistence-details/valkey-redis-persistence-details';
    this.metrics = [
      'Enabled',
      'Appendfsync',
      'Loading Dump',
      'Delayed fsyncs',
      'Last rewrite duration',
      'Last COW size',
      'Last rewrite success',
      'Async Loading',
      'Base, current, last COW size',
      'Last bgsave timestamp',
      'Last bgsave success',
      'Changes since lastsave',
      'Save config',
      'RDB saves',
    ];
  }
}

module.exports = new ValkeyPersistenceDetailsDashboard();
module.exports.ValkeyPersistenceDetailsDashboard = ValkeyPersistenceDetailsDashboard;
