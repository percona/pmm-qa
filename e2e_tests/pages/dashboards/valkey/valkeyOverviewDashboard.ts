import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyOverviewDashboard {
  url = 'graph/d/valkey-overview/valkey-redis-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Min Uptime', type: 'unknown' },
    { name: 'Total Connected/Blocked Clients', type: 'unknown' },
    { name: 'All - Cumulative Read and Write Rate', type: 'unknown' },
    { name: 'Top 5 Commands by Latency (Last 10s)', type: 'unknown' },
    { name: 'Average Latency', type: 'unknown' },
    { name: 'Total Memory Usage', type: 'unknown' },
    { name: 'Cumulative Network I/O', type: 'unknown' },
  ];
}
