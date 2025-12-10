import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeySlowlogDashboard {
  url = 'graph/d/valkey-slowlog/valkey-redis-slowlog';
  metrics: GrafanaPanel[] = [
    { name: 'Slowlog Length', type: 'unknown' },
    { name: 'Slowlog', type: 'unknown' },
    { name: 'Slowlog Maxlength', type: 'unknown' },
    { name: 'Slowlog Slower Than (ms)', type: 'unknown' },
  ];
}
