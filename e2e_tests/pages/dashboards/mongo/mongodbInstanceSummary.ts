import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbInstanceSummary implements DashboardInterface {
  url = 'graph/d/mongodb-instance-summary/mongodb-instance-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Node', type: 'text' },
    { name: 'MongoDB Uptime', type: 'stat' },
    { name: 'QPS', type: 'stat' },
    { name: 'Latency', type: 'stat' },
    { name: 'ReplSet', type: 'stat' },
    { name: 'Current ReplSet State', type: 'stat' },
    { name: 'Command Operations', type: 'timeSeries' },
    { name: 'Latency Detail', type: 'timeSeries' },
    { name: 'Connections', type: 'timeSeries' },
    { name: 'Cursors', type: 'timeSeries' },
    { name: 'Document Operations', type: 'timeSeries' },
    { name: 'Queued Operations', type: 'timeSeries' },
    { name: 'Query Efficiency', type: 'timeSeries' },
    { name: 'Scanned and Moved Objects', type: 'timeSeries' },
    { name: 'getLastError Write Time', type: 'timeSeries' },
    { name: 'getLastError Write Operations', type: 'timeSeries' },
    { name: 'Assert Events', type: 'timeSeries' },
    { name: 'Page Faults', type: 'timeSeries' },
    { name: 'System Uptime', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Disk I/O and Swap Activity', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
}
