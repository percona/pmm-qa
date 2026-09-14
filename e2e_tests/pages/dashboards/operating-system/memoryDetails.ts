import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MemoryDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-memory/memory-details';
  acceptableNoDataCount = 6;
  metrics: GrafanaPanel[] = [
    { name: 'Memory Usage', type: 'unknown' },
    { name: 'Free Memory Percent', type: 'unknown' },
    { name: 'Total Pages Size', type: 'unknown' },
    { name: 'Anonymous Memory Size', type: 'unknown' },
    { name: 'File Cache Memory Size', type: 'unknown' },
    { name: 'Swap Activity', type: 'unknown' },
    { name: 'Swap Space', type: 'unknown' },
    { name: 'Memory Usage Types', type: 'unknown' },
    { name: 'Vmalloc', type: 'unknown' },
    { name: 'Shared Memory', type: 'unknown' },
    { name: 'Kernel Memory Stack', type: 'unknown' },
    { name: 'Committed Memory', type: 'unknown' },
    { name: 'Non-file Backed Pages Size', type: 'unknown' },
    { name: 'Kernel Cache', type: 'unknown' },
    { name: 'DirectMap Pages', type: 'unknown' },
    { name: 'Bounce Memory', type: 'unknown' },
    { name: 'NFS Pages Size', type: 'unknown' },
    { name: 'Unevictable/MLocked Memory', type: 'unknown' },
    { name: 'Huge Pages Size', type: 'unknown' },
    { name: 'HugePages Statistic', type: 'unknown' },
    { name: 'Memory Pages', type: 'unknown' },
    { name: 'IO activity', type: 'unknown' },
    { name: 'Cache Pages', type: 'unknown' },
    { name: 'Anonymous Memory Pages', type: 'unknown' },
    { name: 'Shmem Pages', type: 'unknown' },
    { name: 'Dirty Pages', type: 'unknown' },
    { name: 'Pages Allocated to Page Tables', type: 'unknown' },
    { name: 'Bounce Buffer Pages', type: 'unknown' },
    { name: 'Misc Pages', type: 'unknown' },
    { name: 'Pages Mapped by Files', type: 'unknown' },
    { name: 'Kernel Stack Pages', type: 'unknown' },
    { name: 'Slab Pages', type: 'unknown' },
    { name: 'Allocations', type: 'unknown' },
    { name: 'Refill', type: 'unknown' },
    { name: 'Direct Scan', type: 'unknown' },
    { name: 'Kswapd Scan', type: 'unknown' },
    { name: 'Steal Direct', type: 'unknown' },
    { name: 'Steal Kswapd', type: 'unknown' },
  ];
  noDataMetrics: string[] = [];
}
