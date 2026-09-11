import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

const panelNames = [
  'Mountpoint Usage',
  'Disk Latency',
  'Disk Operations',
  'Disk Bandwidth',
  'Disk Load',
  'Disk IO Utilization',
  'Avg Disks Operations Merge Ratio',
  'Disk IO Size',
];

export default class DiskDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-disk/disk-details';
  acceptableNoDataCount = 3;
  metrics: GrafanaPanel[] = panelNames.map((name) => ({ name, type: 'unknown' }));
  noDataMetrics: string[] = [];
}
