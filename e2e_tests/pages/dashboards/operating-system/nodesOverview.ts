import DashboardInterface from '@interfaces/dashboard';

export default class NodesOverviewDashboard implements DashboardInterface {
  url = 'graph/d/node-instance-overview/nodes-overview';
  metrics = [];
  noDataMetrics = [];
}
