import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class AdvancedDataExplorationDashboard implements DashboardInterface {
  url = 'graph/d/prometheus-advanced/advanced-data-exploration';
  metrics: GrafanaPanel[] = [
    { name: 'View Actual Metric Values (Gauge)', type: 'unknown' },
    { name: 'View Metric Rate of Change (Counter)', type: 'unknown' },
    { name: 'Metric Rates', type: 'unknown' },
    { name: 'Metric Data Table', type: 'unknown' },
  ];
  noDataMetrics: string[] = [];
}
