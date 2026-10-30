import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlInstancesCompareDashboard implements DashboardInterface {
  url = 'graph/d/postgresql-instance-compare/postgresql-instances-compare';
  metrics: GrafanaPanel[] = [
    { name: 'Service Info', type: 'unknown' },
    { name: 'PostgreSQL Connections', type: 'unknown' },
    { name: 'Active Connections', type: 'unknown' },
    { name: 'Tuples', type: 'unknown' },
    { name: 'Transactions', type: 'unknown' },
  ];
  noDataMetrics: string[] = [];
}
