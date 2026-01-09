import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeyClientsDashboard implements DashboardInterface {
  url = 'graph/d/valkey-clients/valkey-redis-clients';
  metrics: GrafanaPanel[] = [
    { name: 'valkey-primary-1-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Connected/Blocked Clients', type: 'unknown' },
    { name: 'Config Max Clients', type: 'unknown' },
    { name: 'Evicted Clients', type: 'unknown' },
    { name: 'valkey-primary-1-svc-* - Client Buffers', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - Client Buffers', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - Client Buffers', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Client Buffers', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Client Buffers', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Client Buffers', type: 'unknown' },
  ];
  noDataMetrics = [];
}
