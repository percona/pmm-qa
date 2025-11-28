import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyReplicationDashboard {
  url = 'graph/d/valkey-replication/valkey-redis-replication';
  metrics: GrafanaPanel[] = [
    { name: 'valkey-primary-1-svc-*', type: 'unknown' },
    { name: 'valkey-primary-2-svc-*', type: 'unknown' },
    { name: 'valkey-primary-3-svc-*', type: 'unknown' },
    { name: 'valkey-replica-4-svc-*', type: 'unknown' },
    { name: 'valkey-replica-5-svc-*', type: 'unknown' },
    { name: 'valkey-replica-6-svc-*', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Replica vs Master offsets', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Replica vs Master offsets', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Replica vs Master offsets', type: 'unknown' },
    { name: 'Replicas', type: 'unknown' },
    { name: 'Connected Replicas', type: 'unknown' },
    { name: 'Full resyncs', type: 'unknown' },
    { name: 'Partial resyncs', type: 'unknown' },
    { name: 'Backlog Size', type: 'unknown' },
    { name: 'Backlog first byte offset', type: 'unknown' },
    { name: 'Backlog History Bytes', type: 'unknown' },
    { name: 'Replica Resync Info', type: 'unknown' },
  ];
}
