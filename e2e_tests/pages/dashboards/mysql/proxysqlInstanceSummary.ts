import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class ProxysqlInstanceSummary implements DashboardInterface {
  url = 'graph/d/proxysql-instance-summary/proxysql-instance-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Hostgroup Size', type: 'timeSeries' },
    { name: 'Client Connections (All Host Groups)', type: 'timeSeries' },
    { name: 'Client Questions (All Host Groups)', type: 'timeSeries' },
    { name: 'Active Backend Connections', type: 'timeSeries' },
    { name: 'Failed Backend Connections', type: 'timeSeries' },
    { name: 'Top 30 Active Frontend Connections', type: 'timeSeries' },
    { name: 'Client Frontend Connections', type: 'timeSeries' },
    { name: 'Endpoint Status', type: 'table' },
    { name: 'Queries Routed', type: 'timeSeries' },
    { name: 'Query processor time efficiency', type: 'timeSeries' },
    { name: 'Connection Free', type: 'timeSeries' },
    { name: 'Endpoints Latency', type: 'timeSeries' },
    { name: 'Executed Queries', type: 'timeSeries' },
    { name: 'Queries Execution Time', type: 'timeSeries' },
    { name: 'Queries Latency', type: 'unknown' },
    { name: 'Query Cache memory', type: 'timeSeries' },
    { name: 'Query Cache efficiency', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
    { name: 'Mirroring efficiency', type: 'timeSeries' },
    { name: 'Memory Utilization', type: 'timeSeries' },
    { name: 'Memory Usage', type: 'timeSeries' },
    { name: 'System Uptime', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'Node', type: 'text' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Disk I/O and Swap Activity', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [
    'Client Frontend Connections',
    'Commands Latency - CREATE_TEMPORARY',
    'Commands Latency - SELECT_FOR_UPDATE',
  ];
}
