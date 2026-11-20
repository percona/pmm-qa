import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbSearchDetails implements DashboardInterface {
  url = 'graph/d/mongodb-search-details/mongodb-search-details';
  // aria-colindex of the Search Indexes columns.
  indexesColumns = { status: 4 };
  indexesTable = 'Search Indexes';
  overviewTiles = [
    'mongot Services Down',
    'Indexes Not STEADY',
    'Worst Replication Lag',
    'Lowest Data Path Free',
    '$search/s',
    '$vectorSearch/s',
    'Highest Heap Used',
    'Shortest Uptime',
  ];
  searchStagesGraph = 'Search Stages Executed on mongod';
  metrics: GrafanaPanel[] = [
    ...this.overviewTiles.map((name): GrafanaPanel => ({ name, type: 'stat' })),
    { name: 'Search Services', type: 'table' },
    { name: this.indexesTable, type: 'table' },
    { name: 'Max Replication Lag per Service', type: 'timeSeries' },
    { name: 'Search Command Rate', type: 'timeSeries' },
    { name: this.searchStagesGraph, type: 'timeSeries' },
    { name: 'Indexing Queue', type: 'timeSeries' },
    { name: 'Total Index Size per Service', type: 'timeSeries' },
    { name: 'JVM Heap', type: 'timeSeries' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'Connections', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
  perServiceGraphs = ['Max Replication Lag per Service', 'Data Path Free Space'];
  steady = 'STEADY';
}
