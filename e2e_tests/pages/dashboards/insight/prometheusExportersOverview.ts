import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PrometheusExportersOverviewDashboard implements DashboardInterface {
  url = 'graph/d/prometheus-overview/prometheus-exporters-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Avg CPU Usage per Node', type: 'unknown' },
    { name: 'Avg Memory Usage per Node', type: 'unknown' },
    { name: 'Monitored Nodes', type: 'unknown' },
    { name: 'Exporters Running', type: 'unknown' },
    { name: 'CPU Usage', type: 'unknown' },
    { name: 'Memory Usage', type: 'unknown' },
    { name: 'CPU Cores Used', type: 'unknown' },
    { name: 'CPU Used', type: 'unknown' },
    { name: 'Mem Used', type: 'unknown' },
    { name: 'Virtual CPUs', type: 'unknown' },
    { name: 'RAM', type: 'unknown' },
    { name: 'File Descriptors Used', type: 'unknown' },
  ];
  noDataMetrics: string[] = [];
}
