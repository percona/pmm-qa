import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class NodesCompareDashboard implements DashboardInterface {
  url = 'graph/d/node-instance-compare/nodes-compare';
  metrics: GrafanaPanel[] = [
    { name: 'System Info', type: 'unknown' },
    { name: 'System Uptime', type: 'unknown' },
    { name: 'CPU Cores', type: 'unknown' },
    { name: 'RAM', type: 'unknown' },
    { name: 'Saturation Metrics', type: 'unknown' },
    { name: 'Load Average', type: 'unknown' },
    { name: 'CPU Usage', type: 'unknown' },
    { name: 'Interrupts', type: 'unknown' },
    { name: 'Context Switches', type: 'unknown' },
    { name: 'Memory Usage', type: 'unknown' },
    { name: 'Swap Usage', type: 'unknown' },
    { name: 'Swap Activity', type: 'unknown' },
    { name: 'Mountpoint Usage', type: 'unknown' },
    { name: 'Free Space', type: 'unknown' },
    { name: 'Disk Operations', type: 'unknown' },
    { name: 'Disk Bandwidth', type: 'unknown' },
    { name: 'Disk IO Utilization', type: 'unknown' },
    { name: 'Disk Latency', type: 'unknown' },
    { name: 'Disk Load', type: 'unknown' },
    { name: 'Network Traffic', type: 'unknown' },
    { name: 'Network Utilization Hourly', type: 'unknown' },
    { name: 'I/O Activity', type: 'unknown' },
  ];
  noDataMetrics: string[] = ['Network Utilization Hourly'];
}
