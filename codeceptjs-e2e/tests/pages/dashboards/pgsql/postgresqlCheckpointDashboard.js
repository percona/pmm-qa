class PostgresqlCheckpointDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-checkpoints-overview/postgresql-checkpoints-buffers-and-wal-usage';
    this.metrics = [
      'Checkpoint Timeout',
      'Checkpoint Completion Target',
      'Checkpoint Flush After',
      'Log Checkpoints',
      'Log Checkpoint Warning',
      'fsync',
      'Min WAL Size',
      'Max WAL Size',
      'WAL Buffers',
      'WAL Keep Size',
      'Full Page Writes',
      'Disk I/O and Swap Activity',
      'CPU Usage',
      'Checkpoints',
      'Background Writer Sync and Write Times',
      'WAL Writes',
      'WAL Writes Per Checkpoint Timeout',
      'Shared Buffers',
      'BgWriter LRU Max Pages',
      'BgWriter Delay',
      'BgWriter Flush After',
      'BgWriter LRU Multiplier',
      'BgWriter Stats Reset',
      'Buffers Read',
      'Buffers Written',
      'Fsync Backend Calls',
      'Background Writer Stops due to LRU max Reached',
    ];
  }
}

module.exports = new PostgresqlCheckpointDashboard();
module.exports.postgresqlCheckpointDashboard = PostgresqlCheckpointDashboard;
