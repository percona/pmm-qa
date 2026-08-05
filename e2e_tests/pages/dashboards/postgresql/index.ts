import DashboardInterface from '../../../interfaces/dashboard';
import PostgresqlInstancesOverviewDashboard from './postgresqlInstancesOverview';

const PostgresqlDashboards = {
  instanceOverview: new PostgresqlInstancesOverviewDashboard(),
};

export type PostgresqlDashboardsType = typeof PostgresqlDashboards & Record<string, DashboardInterface>;
export default PostgresqlDashboards;
