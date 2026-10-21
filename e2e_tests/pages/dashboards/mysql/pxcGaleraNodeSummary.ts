import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PXCGaleraNodeSummary implements DashboardInterface {
  url = 'graph/d/pxc-node-summary/pxc-galera-node-summary';
  metrics: GrafanaPanel[] = [
    { name: 'Ready to Accept Queries', type: 'stat' },
    { name: 'Local State', type: 'stat' },
    { name: 'Desync Mode', type: 'stat' },
    { name: 'Cluster Status', type: 'stat' },
    { name: 'gcache Size', type: 'stat' },
    { name: 'FC (normal traffic)', type: 'stat' },
    { name: 'Galera Replication Latency', type: 'timeSeries' },
    { name: 'Galera Replication Queues', type: 'timeSeries' },
    { name: 'Galera Cluster Size', type: 'timeSeries' },
    { name: 'Galera Flow Control', type: 'timeSeries' },
    { name: 'Galera Parallelization Efficiency', type: 'timeSeries' },
    { name: 'Galera Writing Conflicts', type: 'timeSeries' },
    { name: 'Available Downtime before SST Required', type: 'timeSeries' },
    { name: 'Galera Writeset Count', type: 'timeSeries' },
    { name: 'Galera Writeset Size', type: 'timeSeries' },
    { name: 'Galera Writeset Traffic', type: 'timeSeries' },
    { name: 'Galera Network Usage Hourly', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = ['Galera Network Usage Hourly'];
}
