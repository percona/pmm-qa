const { I } = inject();

class PostgresqlInstanceOverviewDashboard {
  constructor() {
    this.url = 'graph/d/postgresql-instance-overview/postgresql-instances-overview';
    this.metrics = [
      'Databases Monitored',
      'Executed Queries',
      'Slow Queries',
      'Execution Time',
      'Transactions per Second',
      'Lowest Uptime (top 3)',
      'Queries',
    ];
  }
}

module.exports = new PostgresqlInstanceOverviewDashboard();
module.exports.PostgresqlInstanceOverviewDashboard = PostgresqlInstanceOverviewDashboard;
