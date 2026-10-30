import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbClusterSyncDetails implements DashboardInterface {
  url = 'graph/d/mongodb-clustersync-details/mongodb-clustersync-details';
  // Source and target columns share these titles: the first panel is the source's, the last the target's.
  clusterStats = ['Members Down', 'Max Node CPU', 'Internal Replication Lag'];
  metrics: GrafanaPanel[] = [
    { name: 'Lag Time', type: 'timeSeries' },
    { name: 'Change Events Rate', type: 'timeSeries' },
    { name: 'Operations', type: 'timeSeries' },
    { name: 'Operation Latency', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
  pipelineMetrics: GrafanaPanel[] = [
    { name: 'Dispatcher Queue', type: 'timeSeries' },
    { name: 'Worker Event Queues', type: 'timeSeries' },
    { name: 'Worker Bulk Queues', type: 'timeSeries' },
    { name: 'Worker Events Applied', type: 'timeSeries' },
    { name: 'Flush Duration (p99)', type: 'timeSeries' },
    { name: 'Flush Batch Size (p99)', type: 'timeSeries' },
  ];
  processPanels = [
    'CPU Usage',
    'Resident Memory',
    'File Descriptors',
    'Goroutines and Threads',
    'Go Heap',
    'GC Pause Duration',
  ];
  progressMetrics: GrafanaPanel[] = [
    { name: 'Copied vs Estimated Size', type: 'timeSeries' },
    { name: 'Copy Throughput', type: 'timeSeries' },
    { name: 'Documents Copied per Second', type: 'timeSeries' },
    { name: 'Batch Duration', type: 'timeSeries' },
    { name: 'Lag vs Source Oplog Window', type: 'timeSeries' },
  ];
  rows = {
    health: '1 · Is the migration healthy?',
    howTo: 'How to use this dashboard',
    instances: '4 · Are the ClusterSync instances healthy?',
    pipeline: '3 · Why is replication slow or stuck?',
    progress: '2 · Is replication progressing?',
  };
  title = 'MongoDB ClusterSync Details';

  perWorkerPanels = (serviceName: string) => [
    `Worker Event Queue - ${serviceName}`,
    `Worker Events Applied - ${serviceName}`,
    `Worker Flush Duration (p99) - ${serviceName}`,
  ];
}
