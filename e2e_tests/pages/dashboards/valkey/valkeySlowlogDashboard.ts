import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeySlowlogDashboard {
  url = 'graph/d/valkey-slowlog/valkey-redis-slowlog';
  metrics: GrafanaPanel[] = [
    { name: 'Slowlog length', type: 'unknown' },
    { name: 'Slowlog', type: 'unknown' },
    { name: 'Slowlog maxlength', type: 'unknown' },
    { name: 'Slowlog slower than (ms)', type: 'unknown' },
  ];
}
