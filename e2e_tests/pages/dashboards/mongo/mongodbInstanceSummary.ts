import DashboardInterface from '@interfaces/dashboard';

export default class MongodbInstanceSummary implements DashboardInterface {
  url = 'graph/d/mongodb-instance-summary/mongodb-instance-summary';
  metrics = [];
  noDataMetrics = [];
}
