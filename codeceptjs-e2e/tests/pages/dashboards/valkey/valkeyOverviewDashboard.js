class ValkeyOverviewDashboard {
  constructor() {
    this.url = 'graph/d/valkey-overview/valkey-redis-overview';
    this.metrics = [
      'Min Uptime',
      'Total Connected/Blocked Clients',
      'All - Cumulative Read and Write Rate',
      'Top 5 Commands by Latency (Last 10s)',
      'Average Latency',
      'Total Memory Usage',
      'Cumulative Network I/O',
    ];
  }
}

module.exports = new ValkeyOverviewDashboard();
module.exports.ValkeyOverviewDashboard = ValkeyOverviewDashboard;
