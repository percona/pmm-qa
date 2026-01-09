import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeyClusterDetailsDashboard implements DashboardInterface {
  url = 'graph/d/valkey-cluster-details/valkey-redis-cluster-details';
  metrics: GrafanaPanel[] = [
    { name: 'Slots Status', type: 'unknown' },
    { name: 'All - Cluster State', type: 'unknown' },
    { name: 'Cluster Messages', type: 'unknown' },
    { name: 'All - Cluster Connections', type: 'unknown' },
    { name: 'All - Known Nodes', type: 'unknown' },
    { name: 'valkey-primary-1-svc-*', type: 'unknown' },
    { name: 'valkey-primary-2-svc-*', type: 'unknown' },
    { name: 'valkey-primary-3-svc-*', type: 'unknown' },
    { name: 'valkey-replica-4-svc-*', type: 'unknown' },
    { name: 'valkey-replica-5-svc-*', type: 'unknown' },
    { name: 'valkey-replica-6-svc-*', type: 'unknown' },
    { name: 'All - Replica vs Master offsets', type: 'unknown' },
    { name: 'Replicas', type: 'unknown' },
    { name: 'Connected Replicas', type: 'unknown' },
    { name: 'Full Resyncs', type: 'unknown' },
    { name: 'Partial Resyncs', type: 'unknown' },
    { name: 'Backlog Size', type: 'unknown' },
    { name: 'Backlog First Byte Offset', type: 'unknown' },
    { name: 'Backlog History Bytes', type: 'unknown' },
    { name: 'Replica Resync Info', type: 'unknown' },
  ];
  noDataMetrics = [];
}
