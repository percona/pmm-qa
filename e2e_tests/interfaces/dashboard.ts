import { GrafanaPanel } from './grafanaPanel';

export default interface DashboardInterface {
  url: string;
  metrics: GrafanaPanel[];
  noDataMetrics: string[];
}
