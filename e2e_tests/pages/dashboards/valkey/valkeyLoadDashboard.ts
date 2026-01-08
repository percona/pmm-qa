import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeyLoadDashboard implements DashboardInterface {
  url = 'graph/d/valkey-load/valkey-redis-load';
  metrics: GrafanaPanel[] = [
    { name: 'All - Total Commands/Sec', type: 'unknown' },
    { name: 'valkey-primary-1-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-primary-2-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-primary-3-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-replica-4-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-replica-5-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-replica-6-svc-* - Read and Write Rate', type: 'unknown' },
    { name: 'valkey-primary-1-node-* - Commands by Type', type: 'unknown' },
    { name: 'valkey-primary-2-node-* - Commands by Type', type: 'unknown' },
    { name: 'valkey-primary-3-node-* - Commands by Type', type: 'unknown' },
    { name: 'valkey-replica-4-node-* - Commands by Type', type: 'unknown' },
    { name: 'valkey-replica-5-node-* - Commands by Type', type: 'unknown' },
    { name: 'valkey-replica-6-node-* - Commands by Type', type: 'unknown' },
    { name: 'All - Hits/Misses per Sec', type: 'unknown' },
    { name: 'IO thread Operations', type: 'unknown' },
    { name: 'IO Threads Configured', type: 'unknown' },
    { name: 'IO Threads Active', type: 'unknown' },
  ];
  noDataMetrics = [];
}
