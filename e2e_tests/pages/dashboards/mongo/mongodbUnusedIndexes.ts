import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MongodbUnusedIndexes implements DashboardInterface {
  url = 'graph/d/mongodb-unused-indexes/mongodb-unused-indexes';
  metrics: GrafanaPanel[] = [
    { name: 'About Unused Indexes', type: 'text' },
    { name: 'Instance Uptime', type: 'stat' },
    { name: 'Unused Indexes', type: 'stat' },
    { name: 'Indexes Monitored', type: 'stat' },
    { name: 'Unused Indexes by Collection', type: 'table' },
    { name: 'Index Accesses Since Restart', type: 'timeSeries' },
    { name: 'Least Used Indexes', type: 'table' },
  ];
  noDataMetrics = ['Index Accesses Since Restart'];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
