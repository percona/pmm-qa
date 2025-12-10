import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyPersistenceDetailsDashboard {
  url = 'graph/d/valkey-persistence-details/valkey-redis-persistence-details';
  metrics: GrafanaPanel[] = [
    { name: 'Enabled', type: 'unknown' },
    { name: 'Appendfsync', type: 'unknown' },
    { name: 'Loading Dump', type: 'unknown' },
    { name: 'Delayed fsyncs', type: 'unknown' },
    { name: 'Last Rewrite Duration', type: 'unknown' },
    { name: 'Last COW Size', type: 'unknown' },
    { name: 'Last Rewrite Success', type: 'unknown' },
    { name: 'Async Loading', type: 'unknown' },
    { name: 'Base, Current, Last COW Size', type: 'unknown' },
    { name: 'Last Bgsave Timestamp', type: 'unknown' },
    { name: 'Last Bgsave Success', type: 'unknown' },
    { name: 'Changes Since Last Save', type: 'unknown' },
    { name: 'Save Config', type: 'unknown' },
    { name: 'RDB Saves', type: 'unknown' },
  ];
}
