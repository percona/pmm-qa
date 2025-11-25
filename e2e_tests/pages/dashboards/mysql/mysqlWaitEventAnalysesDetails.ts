import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MysqlWaitEventAnalysesDetails {
  constructor() {}

  url = 'graph/d/mysql-waitevents-analysis/mysql-wait-event-analyses-details';
  metrics: GrafanaPanel[] = [
    { name: 'Count - Performance Schema Waits', type: 'timeSeries' },
    { name: 'Load - Performance Schema Waits', type: 'timeSeries' },
    { name: 'Avg Wait Time - Performance Schema Waits', type: 'timeSeries' },

    { name: 'MySQL Uptime', type: 'stat' },
    { name: 'Version', type: 'stat' },
    { name: 'Current QPS', type: 'stat' },
    { name: 'File Handlers Used', type: 'stat' },
    { name: 'Table Open Cache Miss Ratio', type: 'stat' },
    { name: 'Table Open Cache Size', type: 'stat' },
    { name: 'Table Definition Cache Size', type: 'stat' },
    { name: 'Service', type: 'text' },
    { name: 'MySQL Connections', type: 'timeSeries' },
    { name: 'MySQL Client Thread Activity', type: 'timeSeries' },
    { name: 'Count - Performance Schema Waits', type: 'timeSeries' },
    { name: 'Count - Performance Schema Waits', type: 'timeSeries' },
  ];
}
