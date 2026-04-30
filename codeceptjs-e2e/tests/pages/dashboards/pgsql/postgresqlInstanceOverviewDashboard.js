const { I } = inject();

class PostgresqlInstanceOverviewDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-instance-overview/postgresql-instances-overview';
    this.metrics = [
      'Databases monitored',
      'Executed queries',
      'Slow queries',
      'Execution time',
      'Transactions per second',
      'Lowest uptime (top 3)',
      'Queries',
    ];
  }
}

module.exports = new PostgresqlInstanceOverviewDashboard();
module.exports.PostgresqlInstanceOverviewDashboard = PostgresqlInstanceOverviewDashboard;
