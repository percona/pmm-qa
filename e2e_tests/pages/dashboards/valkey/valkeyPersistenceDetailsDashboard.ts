import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyPersistenceDetailsDashboard {
  url = 'graph/d/valkey-persistence-details/valkey-redis-persistence-details';
  metrics: GrafanaPanel[] = [
    { name: 'Enabled', type: 'unknown' },
    { name: 'Appendfsync', type: 'unknown' },
    { name: 'Loading Dump', type: 'unknown' },
    { name: 'Delayed fsyncs', type: 'unknown' },
    { name: 'Last rewrite duration', type: 'unknown' },
    { name: 'Last COW size', type: 'unknown' },
    { name: 'Last rewrite success', type: 'unknown' },
    { name: 'Async Loading', type: 'unknown' },
    { name: 'Base, current, last COW size', type: 'unknown' },
    { name: 'Last bgsave timestamp', type: 'unknown' },
    { name: 'Last bgsave success', type: 'unknown' },
    { name: 'Changes since lastsave', type: 'unknown' },
    { name: 'Save config', type: 'unknown' },
    { name: 'RDB saves', type: 'unknown' },
  ];
}
