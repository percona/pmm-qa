import DashboardInterface from '@interfaces/dashboard';
import PostgresqlInstanceSummary from './postgresqlInstanceSummary';
import PostgresqlInstancesOverviewDashboard from '@pages/dashboards/postgresql/postgresqlInstancesOverview';

export const PostgresqlDashboards = {
  postgresqlInstancesOverview: new PostgresqlInstancesOverviewDashboard(),
  postgresqlInstanceSummary: new PostgresqlInstanceSummary(),
};

export type PostgresqlDashboardsType = typeof PostgresqlDashboards & Record<string, DashboardInterface>;

export default PostgresqlDashboards;
