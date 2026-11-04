import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbOplogDetails implements DashboardInterface {
  url = 'graph/d/mongodb-oplog-details/mongodb-oplog-details';
  metrics: GrafanaPanel[] = [
    { name: 'Oplog Recovery Window', type: 'timeSeries' },
    { name: 'Oplog Buffered Operations', type: 'timeSeries' },
    { name: 'Oplog Getmore Time', type: 'timeSeries' },
    { name: 'Oplog Processing Time', type: 'timeSeries' },
    { name: 'Oplog Buffer Capacity', type: 'timeSeries' },
    { name: 'Oplog Operations', type: 'timeSeries' },
    { name: 'Oplog GB/Hour', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
}
