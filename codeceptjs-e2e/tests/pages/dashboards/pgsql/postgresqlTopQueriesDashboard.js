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
    ];
  }
}

module.exports = new PostgresqlTopQueriesDashboard();
module.exports.PostgresqlTopQueriesDashboard = PostgresqlTopQueriesDashboard;
