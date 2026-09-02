import { GrafanaPanel } from './grafanaPanel';

export default interface DashboardInterface {
  url: string;
  metrics: ((serviceName: string) => GrafanaPanel[]) | GrafanaPanel[];
  noDataMetrics: string[] | ((serviceName: string) => string[]);
}
