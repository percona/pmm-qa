class PostgresqlTopQueriesDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-top-queries/postgresql-top-queries';
    this.metrics = [
      'Transactions per Seconds',
      'Top 10 Slowest Query',
      'Top 10 time spent',
      'Top 10 Queries Executed the most',
      'Top 10 Queries writing the most',
      'Top 10 Queries Affected the most rows',
      'Top 10 User Executed the most queries',
      'Top 10 CPU Intensive Queries',
      'Top 10 Memory Intensive Queries',
      'Top 10 Queries by I/O Wait',
      'Top 10 Queries by Shared Block Reads (Sequential Scan Indicator)',
    ];
  }
}

module.exports = new PostgresqlTopQueriesDashboard();
module.exports.PostgresqlTopQueriesDashboard = PostgresqlTopQueriesDashboard;
