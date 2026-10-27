import DashboardInterface from '@interfaces/dashboard';
import MongodbBackupDetails from './mongodbBackupDetails';
import MongodbCollectionsOverview from './mongodbCollectionsOverview';
import MongodbClusterSyncDetails from './mongodbClusterSyncDetails';
import MongodbInstanceSummary from './mongodbInstanceSummary';
import MongodbInstancesCompare from './mongodbInstancesCompare';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';
import MongodbRouterSummaryDashboard from '@pages/dashboards/mongo/mongodbRouterSummary';
import MongodbShardedClusterSummary from '@pages/dashboards/mongo/mongodbShardedClusterSummary';
import MongodbReplSetSummary from '@pages/dashboards/mongo/mongodbReplSetSummary';

export const MongoDashboards = {
  backupDetails: new MongodbBackupDetails(),
  clusterSyncDetails: new MongodbClusterSyncDetails(),
  collectionsOverview: new MongodbCollectionsOverview(),
  instancesCompare: new MongodbInstancesCompare(),
  instanceSummary: new MongodbInstanceSummary(),
  replSetSummary: new MongodbReplSetSummary(),
  routerSummary: new MongodbRouterSummaryDashboard(),
  shardedClusterSummary: new MongodbShardedClusterSummary(),
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
