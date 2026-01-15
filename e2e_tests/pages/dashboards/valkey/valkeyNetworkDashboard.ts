import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeyNetworkDashboard implements DashboardInterface {
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
  noDataMetrics = [];
}
