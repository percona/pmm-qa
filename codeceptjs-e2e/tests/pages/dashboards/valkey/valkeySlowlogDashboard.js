class ValkeySlowlogDashboard {
  constructor() {
    this.url = 'graph/d/valkey-slowlog/valkey-redis-slowlog';
    this.metrics = ['Slowlog length', 'Slowlog', 'Slowlog maxlength', 'Slowlog slower than (ms)'];
  }
}

module.exports = new ValkeySlowlogDashboard();
module.exports.ValkeySlowlogDashboard = ValkeySlowlogDashboard;
