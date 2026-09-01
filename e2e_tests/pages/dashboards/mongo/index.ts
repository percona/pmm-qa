import DashboardInterface from '@interfaces/dashboard';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';
import MongodbRouterSummaryDashboard from '@pages/dashboards/mongo/mongodbRouterSummary';
import MongodbShardedClusterSummary from '@pages/dashboards/mongo/mongodbShardedClusterSummary';
import MongodbReplSetSummary from '@pages/dashboards/mongo/mongodbReplSetSummary';

export const MongoDashboards = {
  replSetSummary: new MongodbReplSetSummary(),
  routerSummary: new MongodbRouterSummaryDashboard(),
  shardedClusterSummary: new MongodbShardedClusterSummary(),
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
