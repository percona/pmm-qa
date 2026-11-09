import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PmmHealthDashboard implements DashboardInterface {
  url = 'graph/d/pmm-health/pmm-health';
  metrics: GrafanaPanel[] = [
    { name: 'ManageD Status', type: 'stat' },
    { name: 'VictoriaMetrics Status', type: 'stat' },
    { name: 'PostgreSQL Status', type: 'stat' },
    { name: 'QAN API Status', type: 'stat' },
    { name: 'Grafana Status', type: 'stat' },
    { name: 'Node Status', type: 'stat' },
    { name: 'Clickhouse Status', type: 'stat' },
  ];
  noDataMetrics = [];
}
