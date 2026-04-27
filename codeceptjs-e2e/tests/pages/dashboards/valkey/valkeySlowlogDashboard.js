class ValkeySlowlogDashboard {
  constructor() {
    this.url = 'graph/d/valkey-slowlog/valkey-redis-slowlog';
    this.metrics = ['Slowlog Length', 'Slowlog', 'Slowlog Maxlength', 'Slowlog Slower Than (ms)'];
  }
}

module.exports = new ValkeySlowlogDashboard();
module.exports.ValkeySlowlogDashboard = ValkeySlowlogDashboard;
