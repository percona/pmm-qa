class PostgresqlReplicationOverviewDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-replication-overview/postgresql-replication-overview';
    this.metrics = [
      'Primary Host',
      'Number of Replicas',
      'Replicas',
      'Max Replication Lag',
      'Max Written Lag',
      'Max Flush Lag',
      'Max Replay Lag',
      'Replication Members State',
      'Replication Lag (Seconds)',
      'Replication Lag (Bytes)',
      'Top 10 Replication Conflicts by Node',
      'WAL Activity',
      'Replication Slots Status',
      'Top 10 Replication Conflicts',
    ];
  }
}

module.exports = new PostgresqlReplicationOverviewDashboard();
module.exports.PostgresqlReplicationOverviewDashboard = PostgresqlReplicationOverviewDashboard;
