import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PmmHealthDashboard implements DashboardInterface {
  url = 'graph/d/pmm-health/pmm-health';
  metrics: GrafanaPanel[] = [
    { name: 'ManageD Status', type: 'unknown' },
    { name: 'VictoriaMetrics Status', type: 'unknown' },
    { name: 'PostgreSQL Status', type: 'unknown' },
    { name: 'QAN API Status', type: 'unknown' },
    { name: 'Grafana Status', type: 'unknown' },
    { name: 'Node Status', type: 'unknown' },
    { name: 'Clickhouse Status', type: 'unknown' },
  ];
  noDataMetrics = [];
}
