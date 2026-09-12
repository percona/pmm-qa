import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

const panelNames = [
  'Memory Usage',
  'Free Memory Percent',
  'Total Pages Size',
  'Anonymous Memory Size',
  'File Cache Memory Size',
  'Swap Activity',
  'Swap Space',
  'Memory Usage Types',
  'Vmalloc',
  'Shared Memory',
  'Kernel Memory Stack',
  'Committed Memory',
  'Non-file Backed Pages Size',
  'Kernel Cache',
  'DirectMap Pages',
  'Bounce Memory',
  'NFS Pages Size',
  'Unevictable/MLocked Memory',
  'Huge Pages Size',
  'HugePages Statistic',
  'Memory Pages',
  'IO activity',
  'Cache Pages',
  'Anonymous Memory Pages',
  'Shmem Pages',
  'Dirty Pages',
  'Pages Allocated to Page Tables',
  'Bounce Buffer Pages',
  'Misc Pages',
  'Pages Mapped by Files',
  'Kernel Stack Pages',
  'Slab Pages',
  'Allocations',
  'Refill',
  'Direct Scan',
  'Kswapd Scan',
  'Steal Direct',
  'Steal Kswapd',
];

export default class MemoryDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-memory/memory-details';
  acceptableNoDataCount = 6;
  metrics: GrafanaPanel[] = panelNames.map((name) => ({ name, type: 'unknown' }));
  noDataMetrics: string[] = [];
}
