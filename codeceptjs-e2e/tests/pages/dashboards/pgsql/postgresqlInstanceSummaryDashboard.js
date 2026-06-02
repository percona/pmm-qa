class PostgresqlInstanceSummaryDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-instance-summary/postgresql-instance-summary';
    this.metrics = [
      'Service',
      'Connections',
      'Slow queries',
      'Connections per Database',
      'QPS',
      'Number of Locks',
      'Tuples',
      'Queries',
      'Oldest Autovacuum',
      'Dead Tuples %',
      'Transaction Wraparound',
      'CPU',
      'Disk IO Latency',
      'Top 10 Biggest Databases',
      'Service Summary',
      'Tuples',
      'Read Tuple Activity',
      'Tuples Changes by Queries',
      'Transactions',
      'Duration of Transactions',
      'Number of Temp Files',
      'Size of Temp Files',
      'Temp Files Activity',
      'Temp Files Utilization',
      'Conflicts/Deadlocks',
      'Number of Locks',
      'PostgreSQL Settings',
      'System Uptime',
      'Load Average',
      'RAM',
      'Memory Available',
      'Virtual Memory',
      'Disk Space',
      'Min Space Available',
      'Node',
      'CPU Usage',
      'CPU Saturation and Max Core Usage',
      'Disk I/O and Swap Activity',
      'Network Traffic',
    ];
  }
}

module.exports = new PostgresqlInstanceSummaryDashboard();
module.exports.PostgresqlInstanceSummaryDashboard = PostgresqlInstanceSummaryDashboard;
