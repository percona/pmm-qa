import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PostgresqlInstancesOverviewDashboard {
  url = 'graph/d/mysql-instance-overview/mysql-instances-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Databases monitored', type: 'stat' },
    { name: 'Executed queries', type: 'timeSeries' },
    { name: 'Slow queries', type: 'stat' },
    { name: 'Transactions per second', type: 'stat' },
    { name: 'Execution time', type: 'timeSeries' },
    { name: 'Lowest uptime (top 3)', type: 'barGauge' },
    { name: 'Queries', type: 'table' },
  ];
  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
