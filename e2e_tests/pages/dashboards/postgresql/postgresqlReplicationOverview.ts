import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlReplicationOverviewDashboard implements DashboardInterface {
  url = 'graph/d/postgresql-replication-overview/postgresql-replication-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Primary Host', type: 'stat' },
    { name: 'Number of Replicas', type: 'stat' },
    { name: 'Replicas', type: 'table' },
    { name: 'Max Replication Lag', type: 'stat' },
    { name: 'Max Written Lag', type: 'stat' },
    { name: 'Max Flush Lag', type: 'stat' },
    { name: 'Max Replay Lag', type: 'stat' },
    { name: 'Replication Members State', type: 'stateTime' },
    { name: 'Replication Lag (Seconds)', type: 'timeSeries' },
    { name: 'Replication Lag (Bytes)', type: 'timeSeries' },
    { name: 'Top 10 Replication Conflicts by Node', type: 'timeSeries' },
    { name: 'WAL Activity', type: 'timeSeries' },
    { name: 'Replication Slots Status', type: 'timeSeries' },
    { name: 'Top 10 Replication Conflicts', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
}
