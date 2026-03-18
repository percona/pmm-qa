import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class HomeDashboard implements DashboardInterface {
  url = 'graph/d/pmm-home/home-dashboard';
  noDataMetrics: string[] = [];

  metrics = (): GrafanaPanel[] => [{ name: `Failed advisors`, type: 'text' }];

  metricsWithData = () => this.metrics().filter((metric) => !this.noDataMetrics.includes(metric.name));
}
