import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class DiskDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-disk/disk-details';
  acceptableNoDataCount = 3;
  metrics: GrafanaPanel[] = [
    { name: 'Mountpoint Usage', type: 'unknown' },
    { name: 'Disk Latency', type: 'unknown' },
    { name: 'Disk Operations', type: 'unknown' },
    { name: 'Disk Bandwidth', type: 'unknown' },
    { name: 'Disk Load', type: 'unknown' },
    { name: 'Disk IO Utilization', type: 'unknown' },
    { name: 'Avg Disks Operations Merge Ratio', type: 'unknown' },
    { name: 'Disk IO Size', type: 'unknown' },
  ];
  name = 'Disk Details';
  noDataMetrics: string[] = [];
}
