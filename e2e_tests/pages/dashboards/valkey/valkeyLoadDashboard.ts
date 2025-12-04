import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class ValkeyLoadDashboard {
  url = 'graph/d/valkey-load/valkey-redis-load';
  metrics: GrafanaPanel[] = [
      { name: 'All - Total Commands / sec', type: 'unknown' },
      { name: 'valkey-primary-1-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-primary-2-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-primary-3-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-replica-4-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-replica-5-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-replica-6-svc-* - Read and Write rate', type: 'unknown' },
      { name: 'valkey-primary-1-node-* - command ops/sec', type: 'unknown' },
      { name: 'valkey-primary-2-node-* - command ops/sec', type: 'unknown' },
      { name: 'valkey-primary-3-node-* - command ops/sec', type: 'unknown' },
      { name: 'valkey-replica-4-node-* - command ops/sec', type: 'unknown' },
      { name: 'valkey-replica-5-node-* - command ops/sec', type: 'unknown' },
      { name: 'valkey-replica-6-node-* - command ops/sec', type: 'unknown' },
      { name: 'All - Hits / Misses per Sec', type: 'unknown' },
      { name: 'IO thread R/W per Sec', type: 'unknown' },
      { name: 'IO threads configured', type: 'unknown' },
      { name: 'IO threads active', type: 'unknown' },
  ];
}
