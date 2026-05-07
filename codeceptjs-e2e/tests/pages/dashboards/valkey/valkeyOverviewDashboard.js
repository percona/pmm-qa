class ValkeyOverviewDashboard {
  constructor() {
    this.url = 'graph/d/valkey-overview/valkey-redis-overview';
    this.metrics = [
      'Min Uptime',
      'Total Connected/Blocked Clients',
      'All - Cumulative Read and Write rate',
      'Top 5 Max Latency - last 10s',
      'Avg Latency',
      'Total Memory Usage',
      'Cumulative network I/O',
    ];
  }
}

module.exports = new ValkeyOverviewDashboard();
module.exports.ValkeyOverviewDashboard = ValkeyOverviewDashboard;
