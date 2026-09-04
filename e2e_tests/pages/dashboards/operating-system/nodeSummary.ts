import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class NodeSummaryDashboard implements DashboardInterface {
  url = 'graph/d/node-instance-summary/node-summary';
  metrics: GrafanaPanel[] = [
    { name: 'System Uptime', type: 'stat' },
    { name: 'Virtual CPUs', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'Time before run out of space', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'System Summary', type: 'summary' },
    { name: 'Service Types', type: 'table' },
    { name: 'Services', type: 'polyStat' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Interrupts and Context Switches', type: 'timeSeries' },
    { name: 'Processes', type: 'timeSeries' },
    { name: 'Memory Utilization', type: 'timeSeries' },
    { name: 'Virtual Memory Utilization', type: 'timeSeries' },
    { name: 'Swap Space', type: 'timeSeries' },
    { name: 'Swap Activity', type: 'timeSeries' },
    { name: 'I/O Activity', type: 'timeSeries' },
    { name: 'Global File Descriptors Usage', type: 'timeSeries' },
    { name: 'Disk IO Latency', type: 'timeSeries' },
    { name: 'Disk IO Load', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
    { name: 'Network Utilization Hourly', type: 'timeSeries' },
    { name: 'Local Network Errors', type: 'timeSeries' },
    { name: 'TCP Retransmission', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = ['Network Utilization Hourly'];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
