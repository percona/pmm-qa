import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PrometheusExporterStatusDashboard implements DashboardInterface {
  url = 'graph/d/prometheus-status/prometheus-exporter-status';
  metrics: GrafanaPanel[] = [
    { name: 'CPU Usage', type: 'unknown' },
    { name: 'Memory Usage', type: 'unknown' },
    { name: 'File Descriptors Used', type: 'unknown' },
    { name: 'Exporter Uptime', type: 'unknown' },
    { name: 'Collector Scrape Successful', type: 'unknown' },
    { name: 'Collector Execution Time (Log Scale)', type: 'unknown' },
    { name: 'Collector Execution Time', type: 'unknown' },
    { name: 'MySQL Exporter Errors', type: 'unknown' },
    { name: 'Rate of Scrapes', type: 'unknown' },
    { name: 'MySQL up', type: 'unknown' },
    { name: 'MongoDB Scrape Performance', type: 'unknown' },
    { name: 'MongoDB Exporter Errors', type: 'unknown' },
    { name: 'MongoDB up', type: 'unknown' },
    { name: 'ProxySQL Scrape Performance', type: 'unknown' },
    { name: 'ProxySQL Exporter Errors', type: 'unknown' },
    { name: 'ProxySQL up', type: 'unknown' },
    { name: 'Scrape Durations', type: 'unknown' },
  ];
  noDataMetrics: string[] = [
    'Agent Uptime',
    'CPU Usage',
    'Collector Execution Time',
    'Exporter Uptime',
    'File Descriptors Used',
    'Memory Usage',
    'MongoDB Exporter Errors',
    'MongoDB Scrape Performance',
    'MongoDB up',
    'MySQL Exporter Errors',
    'MySQL up',
    'ProxySQL Exporter Errors',
    'ProxySQL Scrape Performance',
    'ProxySQL up',
    'Rate of Scrapes',
    'Resident Memory Usage',
    'Samples',
    'Scrape Durations',
    'Scrapes Durations',
    'Virtual Memory Usage',
  ];
}
