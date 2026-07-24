class PostgresqlPatroniDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-patroni-details/postgresql-patroni-details';
    this.metrics = [
      'Patroni Version',
      'Patroni DCS Last Seen',
      'Patroni Leader',
      'Patroni Replica',
      'Patroni Standby Leader',
      'Patroni Autofailover',
      'Patroni Cluster Unlocked',
      'Patroni Falisafe Mode Active',
      'Patroni Nodes State',
      'PostgreSQL Version',
      'Uptime',
      'Running',
      'Timeline',
      'Pending Restart',
      'WAL Replay',
      'In Archive Recovery',
      'Streaming',
      'Sync Standby',
      'Primary WAL Location',
      'Replicas Received WAL Location',
      'Replicas Replayed WAL Location',
      'WAL Replay Paused',
    ];
  }
}

module.exports = new PostgresqlPatroniDashboard();
module.exports.PostgresqlPatroniDashboard = PostgresqlPatroniDashboard;
