import DashboardInterface from '@interfaces/dashboard';
import PostgresqlInstanceSummary from './postgresqlInstanceSummary';
import PostgresqlInstancesCompareDashboard from '@pages/dashboards/postgresql/postgresqlInstancesCompare';
import PostgresqlInstancesOverviewDashboard from '@pages/dashboards/postgresql/postgresqlInstancesOverview';
import PostgresqlInstancesOverviewExtendedDashboard from '@pages/dashboards/postgresql/postgresqlInstancesOverviewExtended';
import PostgresqlPatroniDetailsDashboard from '@pages/dashboards/postgresql/postgresqlPatroniDetails';
import PostgresqlReplicationOverviewDashboard from '@pages/dashboards/postgresql/postgresqlReplicationOverview';
import PostgresqlTopQueriesDashboard from '@pages/dashboards/postgresql/postgresqlTopQueries';

export const PostgresqlDashboards = {
  postgresqlInstancesCompare: new PostgresqlInstancesCompareDashboard(),
  postgresqlInstancesOverview: new PostgresqlInstancesOverviewDashboard(),
  postgresqlInstancesOverviewExtended: new PostgresqlInstancesOverviewExtendedDashboard(),
  postgresqlInstanceSummary: new PostgresqlInstanceSummary(),
  postgresqlPatroniDetails: new PostgresqlPatroniDetailsDashboard(),
  postgresqlReplicationOverview: new PostgresqlReplicationOverviewDashboard(),
  postgresqlTopQueries: new PostgresqlTopQueriesDashboard(),
};

export type PostgresqlDashboardsType = typeof PostgresqlDashboards & Record<string, DashboardInterface>;

export default PostgresqlDashboards;
