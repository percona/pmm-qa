import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbSearchHealth implements DashboardInterface {
  url = 'graph/d/mongodb-search-health/mongodb-search-health';
  // aria-colindex of the Health by Service columns.
  healthColumns = { health: 4, replicaSet: 3, up: 5 };
  healthTable = 'Health by Service';
  tiles = [
    'Overall',
    'Availability',
    'Errors',
    'Latency P99',
    'Freshness',
    'Index Health',
    'Disk Free',
    'Heap',
  ];
  trends = ['Latency P99 Trend', 'Freshness Trend', 'Errors Trend'];
  metrics: GrafanaPanel[] = [
    ...this.tiles.map((name): GrafanaPanel => ({ name, type: 'stat' })),
    { name: this.healthTable, type: 'table' },
    ...this.trends.map((name): GrafanaPanel => ({ name, type: 'timeSeries' })),
  ];
  noDataMetrics: string[] = [];
  texts = {
    allHealthy: 'All healthy',
    allSteady: 'All STEADY',
    allUp: 'All up',
    attention: 'ATTENTION',
    down: 'DOWN',
    noData: 'No data',
    ok: 'OK',
    oneDown: '1 down',
    oneNeedsAttention: '1 need attention',
    up: 'UP',
  };
}
