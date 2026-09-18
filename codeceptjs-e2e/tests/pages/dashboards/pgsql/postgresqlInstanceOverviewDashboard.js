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
    ];
  }

  // PMM-15104 renamed this panel in 3.10.0. The ami nightly lane and the RC
  // lanes still run GA servers, so the expected title follows the server.
  metricsFor({ major, minor }) {
    const renamed = major > 3 || (major === 3 && minor >= 10);

    return [...this.metrics, renamed ? 'Top slow queries' : 'Queries'];
  }
}

module.exports = new PostgresqlInstanceOverviewDashboard();
module.exports.PostgresqlInstanceOverviewDashboard = PostgresqlInstanceOverviewDashboard;
