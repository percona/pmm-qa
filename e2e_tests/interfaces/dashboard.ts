import { GrafanaPanel } from './grafanaPanel';

export default interface DashboardInterface {
  url: string;
  metrics: GrafanaPanel[] | ((serviceName: string) => GrafanaPanel[]);
  noDataMetrics: string[] | ((serviceName: string) => string[]);
}
