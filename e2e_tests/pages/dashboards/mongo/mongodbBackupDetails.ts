import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MongodbBackupDetails implements DashboardInterface {
  url = 'graph/d/mongodb-backup-details/mongodb-backup-details';
  metrics: GrafanaPanel[] = [
    { name: 'Backup Configured', type: 'stat' },
    { name: 'PITR Status', type: 'stat' },
    { name: 'Backup Agents', type: 'stat' },
    { name: 'Last Successful Backup', type: 'stat' },
    { name: 'Backup Agent Summary', type: 'pie' },
    { name: 'Backup Agent Status', type: 'polyStat' },
    { name: 'Backup agent status over time', type: 'stateTime' },
    { name: 'Backup history', type: 'table' },
    { name: 'Backup Sizes', type: 'unknown' },
    { name: 'Backup Duration', type: 'unknown' },
  ];
  noDataMetrics = [];
}
