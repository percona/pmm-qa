class ValkeyPersistenceDetailsDashboard {
  constructor() {
    this.url = 'graph/d/valkey-persistence-details/valkey-redis-persistence-details';
    this.metrics = [
      'Enabled',
      'Appendfsync',
      'Loading Dump',
      'Delayed fsyncs',
      'Last Rewrite Duration',
      'Last COW Size',
      'Last Rewrite Success',
      'Async Loading',
      'Base, Current, Last COW Size',
      'Last Bgsave Timestamp',
      'Last Bgsave Success',
      'Changes Since Last Save',
      'Save Config',
      'RDB Saves',
    ];
  }
}

module.exports = new ValkeyPersistenceDetailsDashboard();
module.exports.ValkeyPersistenceDetailsDashboard = ValkeyPersistenceDetailsDashboard;
