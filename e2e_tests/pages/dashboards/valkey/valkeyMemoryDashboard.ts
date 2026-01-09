import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeyMemoryDashboard implements DashboardInterface {
  url = 'graph/d/valkey-memory/valkey-redis-memory';
  metrics: GrafanaPanel[] = [
    { name: 'Memory Usage', type: 'unknown' },
    { name: 'Eviction Policy', type: 'unknown' },
    { name: 'Number of Keys', type: 'unknown' },
    { name: 'Total Memory Usage', type: 'unknown' },
    { name: 'Expired/Evicted Keys', type: 'unknown' },
    { name: 'Expiring vs Not-Expiring Keys', type: 'unknown' },
  ];
  noDataMetrics = [];
}
