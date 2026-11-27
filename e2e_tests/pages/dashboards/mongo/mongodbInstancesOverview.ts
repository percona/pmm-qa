import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MongodbInstancesOverview implements DashboardInterface {
  url = 'graph/d/mongodb-instance-overview/mongodb-instances-overview';
  metrics: GrafanaPanel[] = [
    { name: 'Sharded Clusters', type: 'stat' },
    { name: 'Replica Sets', type: 'stat' },
    { name: 'Processes', type: 'stat' },
    { name: 'Availability', type: 'stat' },
    { name: 'Operations', type: 'stat' },
    { name: 'Docs Accessed', type: 'stat' },
    { name: 'Time Since Election', type: 'stat' },
    { name: 'Min Uptime', type: 'stat' },
    { name: 'Node Summary', type: 'pie' },
    { name: 'Replica Set Status', type: 'polyStat' },
    { name: 'Sharded Cluster Status', type: 'polyStat' },
    { name: 'Router Summary', type: 'pie' },
    { name: 'Router Status', type: 'polyStat' },
    { name: 'Top 5 Connections', type: 'timeSeries' },
    { name: 'Current Connections', type: 'polyStat' },
    { name: 'Top 5 Command Operations', type: 'timeSeries' },
    { name: 'Command Operations', type: 'polyStat' },
    { name: 'Top 5 Getmore Operations', type: 'timeSeries' },
    { name: 'Getmore Operations', type: 'polyStat' },
    { name: 'Top 5 Delete Operations', type: 'timeSeries' },
    { name: 'Delete Operations', type: 'polyStat' },
    { name: 'Top 5 Insert Operations', type: 'timeSeries' },
    { name: 'Insert Operations', type: 'polyStat' },
    { name: 'Top 5 Update Operations', type: 'timeSeries' },
    { name: 'Update Operations', type: 'polyStat' },
    { name: 'Top 5 Query Operations', type: 'timeSeries' },
    { name: 'Query Operations', type: 'polyStat' },
    { name: 'Top 5 Document Delete Operations', type: 'timeSeries' },
    { name: 'Document Delete Operations', type: 'polyStat' },
    { name: 'Top 5 Document Insert Operations', type: 'timeSeries' },
    { name: 'Document Insert Operations', type: 'polyStat' },
    { name: 'Top 5 Document Return Operations', type: 'timeSeries' },
    { name: 'Document Return Operations', type: 'polyStat' },
    { name: 'Top 5 Document Update Operations', type: 'timeSeries' },
    { name: 'Document Update Operations', type: 'polyStat' },
    { name: 'Top 5 Queued Read Operations', type: 'timeSeries' },
    { name: 'Queued Read Operations', type: 'polyStat' },
    { name: 'Top 5 Queued Write Operations', type: 'timeSeries' },
    { name: 'Queued Write Operations', type: 'polyStat' },
  ];
  noDataMetrics: string[] = ['Router Summary'];
}
