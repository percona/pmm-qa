import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MongodbRouterSummaryDashboard implements DashboardInterface {
  url = 'graph/d/mongodb-router-summary/mongodb-router-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Routers', type: 'polyStat' },
    { name: 'CPU Usage', type: 'gauge' },
    { name: 'Memory Used', type: 'gauge' },
    { name: 'Disk IO Utilization', type: 'gauge' },
    { name: 'Disk Space Utilization', type: 'gauge' },
    { name: 'Disk IOPS', type: 'stat' },
    { name: 'Network Traffic', type: 'stat' },
    { name: 'Uptime', type: 'stat' },
    { name: 'Version', type: 'stat' },
    { name: 'Command Operations', type: 'timeSeries' },
    { name: 'Queued Operations', type: 'timeSeries' },
    { name: 'Operation Latencies', type: 'timeSeries' },
    { name: 'Average Connections', type: 'timeSeries' },
    { name: 'Reads & Writes', type: 'timeSeries' },
    { name: 'Router Status', type: 'stateTime' },
  ];
  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
