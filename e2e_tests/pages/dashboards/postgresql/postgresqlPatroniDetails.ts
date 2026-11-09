import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlPatroniDetailsDashboard implements DashboardInterface {
  url = 'graph/d/postgresql-patroni-details/postgresql-patroni-details';
  metrics: GrafanaPanel[] = [
    { name: 'Patroni Version', type: 'stat' },
    { name: 'Patroni DCS Last Seen', type: 'stat' },
    { name: 'Patroni Leader', type: 'stat' },
    { name: 'Patroni Replica', type: 'stat' },
    { name: 'Patroni Standby Leader', type: 'stat' },
    { name: 'Patroni Autofailover', type: 'stat' },
    { name: 'Patroni Cluster Unlocked', type: 'stat' },
    { name: 'Patroni Falisafe Mode Active', type: 'stat' },
    { name: 'Patroni Nodes State', type: 'stateTime' },
    { name: 'PostgreSQL Version', type: 'stat' },
    { name: 'Uptime', type: 'stat' },
    { name: 'Running', type: 'stat' },
    { name: 'Timeline', type: 'stat' },
    { name: 'Pending Restart', type: 'stat' },
    { name: 'WAL Replay', type: 'stat' },
    { name: 'In Archive Recovery', type: 'stat' },
    { name: 'Streaming', type: 'stat' },
    { name: 'Sync Standby', type: 'stat' },
    { name: 'Primary WAL Location', type: 'stat' },
    { name: 'Replicas Received WAL Location', type: 'stat' },
    { name: 'Replicas Replayed WAL Location', type: 'stat' },
    { name: 'WAL Replay Paused', type: 'stat' },
  ];
  noDataMetrics: string[] = [];
}
