import DashboardInterface from '@interfaces/dashboard';
import PostgresqlInstanceSummary from './postgresqlInstanceSummary';

export const PostgresqlDashboards = {
  postgresqlInstanceSummary: new PostgresqlInstanceSummary(),
};

export type PostgresqlDashboardsType = typeof PostgresqlDashboards & Record<string, DashboardInterface>;

export default PostgresqlDashboards;
