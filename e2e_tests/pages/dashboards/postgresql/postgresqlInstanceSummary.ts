import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlInstanceSummary implements DashboardInterface {
  url = 'graph/d/postgresql-instance-summary/postgresql-instance-summary';
  metrics = [];
  noDataMetrics = [];
}
