import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PmmHealthDashboard implements DashboardInterface {
  url = 'graph/d/pmm-health/pmm-health';
  statusPanels = [
    { name: 'ManageD Status', panelId: '1086' },
    { name: 'VictoriaMetrics Status', panelId: '1088' },
    { name: 'PostgreSQL Status', panelId: '1089' },
    { name: 'QAN API Status', panelId: '1085' },
    { name: 'Grafana Status', panelId: '1087' },
    { name: 'Node Status', panelId: '1090' },
    { name: 'Clickhouse Status', panelId: '1091' },
  ];
  metrics: GrafanaPanel[] = this.statusPanels.map(({ name }) => ({ name, type: 'unknown' as const }));
  noDataMetrics = [];
}
