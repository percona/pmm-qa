import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyNetworkDashboard {
  url = 'graph/d/valkey-network/valkey-redis-network';
  metrics: GrafanaPanel[] = [
    { name: 'valkey-primary-1-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Network Input', type: 'unknown' },
    { name: 'valkey-primary-1-svc-* - Network Output', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - Network Output', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - Network Output', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Network Output', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Network Output', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Network Output', type: 'unknown' },
  ];
}
