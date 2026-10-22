import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbCollectionsOverview implements DashboardInterface {
  url = 'graph/d/mongodb-collections-overview/mongodb-collections-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Top 5 Databases By Size', type: 'timeSeries' },
    { name: 'Collections in Database', type: 'stat' },
    { name: 'Indexes in Database', type: 'stat' },
    { name: 'Avg Object Size in Database', type: 'timeSeries' },
    { name: 'Index Size in Database', type: 'timeSeries' },
    { name: 'Data Size for Database', type: 'timeSeries' },
    { name: 'Top 5 Hottest Collections by Read  (Total)', type: 'table' },
    { name: 'Top 5 Hottest Collections by Write (Total)', type: 'table' },
    { name: 'Top 5 Hottest Collections by Read (Rate)', type: 'barGauge' },
    { name: 'Top 5 Hottest Collections by Write (Rate)', type: 'barGauge' },
    { name: 'Collections statistics  for All (rate)', type: 'timeSeries' },
    { name: 'Collections statistics  for All (summary)', type: 'timeSeries' },
    { name: 'Collections statistics  admin', type: 'table' },
    { name: 'Collections statistics  config', type: 'table' },
  ];
  noDataMetrics: string[] = [];
}
