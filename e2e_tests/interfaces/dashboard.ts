import { GrafanaPanel } from './grafanaPanel';

export interface MetricsRow {
  metrics: GrafanaPanel[];
  rowName: string;
}

export default interface DashboardInterface {
  url: string;
  metrics:
    | GrafanaPanel[]
    | ((services: string[]) => MetricsRow[])
    | ((serviceName: string) => GrafanaPanel[])
    | ((shardNames: string[], nodeNames: string[], serviceNames: string[]) => GrafanaPanel[]);
  noDataMetrics:
    | string[]
    | ((serviceName: string) => string[])
    | ((shardNames: string[], nodeNames: string[], serviceNames: string[]) => string[]);
}
