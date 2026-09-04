import DashboardInterface from '@interfaces/dashboard';

export default class NodesCompareDashboard implements DashboardInterface {
  url = 'graph/d/node-instance-compare/nodes-compare';
  metrics = [];
  noDataMetrics = [];
}
