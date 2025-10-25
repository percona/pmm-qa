import { GrafanaPanel } from '../../../intefaces/grafanaPanel';

export default class PostgresqlInstancesOverviewDashboard {
  constructor() {}

  url = 'graph/d/postgresql-instance-overview/postgresql-instances-overview';

  metrics: GrafanaPanel[] = [
    { name: 'Executed Queries', type: 'timeSeries' },
    { name: 'Execution Time', type: 'unknown' },
    { name: 'Databases Monitored', type: 'unknown' },
    { name: 'Slow Queries', type: 'unknown' },
    { name: 'Transactions per Second', type: 'stat' },
    { name: 'Lowest Uptime (top 3)', type: 'barGauge' },
    { name: 'Queries', type: 'unknown' },
  ];
  noDataMetrics = [];
}
