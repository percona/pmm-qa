import { GrafanaPanel } from './grafanaPanel';

export default interface DashboardInterface {
  url: string;
  metrics:
    | GrafanaPanel[]
    | ((serviceName: string) => GrafanaPanel[])
    | ((shardNames: string[], nodeNames: string[], serviceNames: string[]) => GrafanaPanel[]);
  noDataMetrics:
    | string[]
    | ((serviceName: string) => string[])
    | ((shardNames: string[], nodeNames: string[], serviceNames: string[]) => string[]);
}
