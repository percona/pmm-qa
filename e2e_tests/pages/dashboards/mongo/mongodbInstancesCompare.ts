import DashboardInterface from '@interfaces/dashboard';

export default class MongodbInstancesCompare implements DashboardInterface {
  url = 'graph/d/mongodb-instance-compare/mongodb-instances-compare';
  metrics = [];
  noDataMetrics = [];
}
