import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class VictoriaMetricsAgentsOverviewDashboard implements DashboardInterface {
  url = 'graph/d/vmagent/victoriametrics-agents-overview';

  metrics = (nodeName: string): GrafanaPanel[] => [
    { name: 'Current Uptime', type: 'table' },
    { name: 'Scraped Targets UP', type: 'stat' },
    { name: 'Scraped Samples', type: 'stat' },
    { name: 'Dropped Samples', type: 'stat' },
    { name: 'Logged Errors', type: 'stat' },
    { name: 'Uptime', type: 'stateTime' },
    { name: 'Scraped Samples', type: 'timeSeries' },
    { name: 'Remotely  Written Samples', type: 'timeSeries' },
    { name: 'Dropped Samples (Persistent Queue)', type: 'timeSeries' },
    { name: 'Persistent Queue Size', type: 'timeSeries' },
    { name: 'Dropped Samples (Relabeling)', type: 'timeSeries' },
    { name: 'HTTP Requests', type: 'timeSeries' },
    { name: `Logged Errors/Warnings - ${nodeName}`, type: 'timeSeries' },
    { name: `HTTP Requests Details - ${nodeName}`, type: 'timeSeries' },
    { name: `HTTP Errors - ${nodeName}`, type: 'timeSeries' },
    { name: 'Scrapes', type: 'timeSeries' },
    { name: 'Samples', type: 'timeSeries' },
    { name: 'Scrapes p0.95 Response Size', type: 'timeSeries' },
    { name: 'Timeout Scrapes', type: 'timeSeries' },
    { name: 'Failed Scrapes', type: 'timeSeries' },
    { name: 'Dial Errors', type: 'timeSeries' },
    { name: 'Gunzip Failed Scrapes', type: 'timeSeries' },
    { name: `Scrapes Duration - ${nodeName}`, type: 'unknown' },
    { name: 'Write Requests', type: 'timeSeries' },
    { name: 'Write Errors', type: 'timeSeries' },
    { name: 'Parsed Rows', type: 'timeSeries' },
    { name: 'Dropped Invalid Rows', type: 'timeSeries' },
    { name: 'Remote Write Requests', type: 'timeSeries' },
    { name: 'Remote Write Size', type: 'timeSeries' },
    { name: 'Block Size Rows', type: 'unknown' },
    { name: 'Block Size in Bytes', type: 'unknown' },
    { name: 'Requests Retry Rate', type: 'timeSeries' },
    { name: 'Established Connections', type: 'timeSeries' },
    { name: `Remote Write Duration - ${nodeName}`, type: 'unknown' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'Memory Usage', type: 'timeSeries' },
    { name: 'Threads', type: 'timeSeries' },
    { name: 'Network  Usage', type: 'timeSeries' },
  ];

  noDataMetrics = (nodeName: string): string[] => ['Gunzip Failed Scrapes', `Scrapes Duration - ${nodeName}`];
}
