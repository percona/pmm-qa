import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class PostgresqlInstancesOverviewDashboard {
  url = 'graph/d/postgresql-instance-overview/postgresql-instances-overview';
  noDataMetrics: string[] = [];
  // The QAN table panel was renamed from "Queries" to "Top slow queries" in PMM
  // 3.10.0 (PMM-15104). An upgrade re-provisions dashboards into grafana's
  // unified storage asynchronously, so during the @post-upgrade window the panel
  // may still carry the pre-rename title. Both are accepted; the newer name is
  // preferred when resolving which one the live dashboard currently exposes.
  topQueriesPanelNames = ['Top slow queries', 'Queries'];

  metrics = (topQueriesPanelName: string = this.topQueriesPanelNames[0]): GrafanaPanel[] => [
    { name: 'Databases monitored', type: 'stat' },
    { name: 'Executed queries', type: 'timeSeries' },
    { name: 'Slow queries', type: 'stat' },
    { name: 'Transactions per second', type: 'stat' },
    { name: 'Execution time', type: 'timeSeries' },
    { name: 'Lowest uptime (top 3)', type: 'barGauge' },
    { name: topQueriesPanelName, type: 'table' },
  ];

  metricsWithData = (topQueriesPanelName?: string): GrafanaPanel[] =>
    this.metrics(topQueriesPanelName).filter((metric) => !this.noDataMetrics.includes(metric.name));
}
