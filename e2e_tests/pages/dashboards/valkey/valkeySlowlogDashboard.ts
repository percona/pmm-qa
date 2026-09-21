import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ValkeySlowlogDashboard implements DashboardInterface {
  url = 'graph/d/valkey-slowlog/valkey-redis-slowlog';
  metrics: GrafanaPanel[] = [
    { name: 'Slowlog Length', type: 'unknown' },
    { name: 'Slowlog', type: 'unknown' },
    { name: 'Slowlog Maxlength', type: 'unknown' },
    { name: 'Slowlog Slower Than (ms)', type: 'unknown' },
  ];
  noDataMetrics = [];
}
