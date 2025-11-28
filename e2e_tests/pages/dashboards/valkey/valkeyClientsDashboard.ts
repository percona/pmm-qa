import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyClientsDashboard {
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
    { name: 'valkey-primary-1-svc-* - client Buffers', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - client Buffers', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - client Buffers', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - client Buffers', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - client Buffers', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - client Buffers', type: 'unknown' },
  ];
}
