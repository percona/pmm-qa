import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyOverviewDashboard {
  url = 'graph/d/valkey-overview/valkey-redis-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Min Uptime', type: 'unknown' },
    { name: 'Total Connected/Blocked Clients', type: 'unknown' },
    { name: 'All - Cumulative Read and Write rate', type: 'unknown' },
    { name: 'Top 5 Max Latency - last 10s', type: 'unknown' },
    { name: 'Avg Latency', type: 'unknown' },
    { name: 'Total Memory Usage', type: 'unknown' },
    { name: 'Cumulative network I/O', type: 'unknown' },
  ];
}
