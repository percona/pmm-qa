import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class NodeSummaryDashboard implements DashboardInterface {
  url = 'graph/d/node-instance-summary/node-summary';
  diskOperations = { panelName: 'Disk Operations', read: 'Read', write: 'Write' };
  diskPanels = ['Disk Operations', 'Disk IO Latency', 'Disk IO Utilization', 'Disk IO Load'];
  diskSpace = 'Disk Space';
  diskUtilization = 'Disk IO Utilization';
  // node_filefd_maximum from a kernel without a file limit is 2^63-1.
  fileDescriptors = {
    allocated: 'Allocated',
    limit: 'Limit',
    limitValue: '2.00 Mil',
    noLimit: '9223372036854775807',
    panelName: 'Global File Descriptors Usage',
    setLimit: '2000000',
  };
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
    { name: 'Services', type: 'table' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Interrupts and Context Switches', type: 'timeSeries' },
    { name: 'Processes', type: 'timeSeries' },
    { name: 'Memory Utilization', type: 'timeSeries' },
    { name: 'Virtual Memory Utilization', type: 'timeSeries' },
    { name: 'Swap Space', type: 'timeSeries' },
    { name: 'Swap Activity', type: 'timeSeries' },
    { name: 'I/O Activity', type: 'timeSeries' },
    { name: 'Disk Operations', type: 'timeSeries' },
    { name: 'Global File Descriptors Usage', type: 'timeSeries' },
    { name: 'Disk IO Latency', type: 'timeSeries' },
    { name: 'Disk IO Utilization', type: 'timeSeries' },
    { name: 'Disk IO Load', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
    { name: 'Network Utilization Hourly', type: 'timeSeries' },
    { name: 'Local Network Errors', type: 'timeSeries' },
    { name: 'TCP Retransmission', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = ['Network Utilization Hourly'];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
  services = {
    columns: ['Service', 'Type', 'Status'],
    down: 'DOWN',
    panelName: 'Services',
    statusColors: { DOWN: 'rgb(242, 73, 92)', UP: 'rgb(115, 191, 105)' } as Record<string, string>,
    up: 'UP',
  };
  serviceTypes = {
    names: { mongodb: 'MongoDB', mysql: 'MySQL', proxysql: 'ProxySQL', valkey: 'Valkey' } as Record<
      string,
      string
    >,
    panelName: 'Service Types',
  };

  systemSummaryHostname = (hostname: string) =>
    new RegExp(`^\\s*Hostname \\| ${hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
}
