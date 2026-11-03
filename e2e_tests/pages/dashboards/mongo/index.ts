import DashboardInterface from '@interfaces/dashboard';
import MongodbBackupDetails from './mongodbBackupDetails';
import MongodbCollectionsOverview from './mongodbCollectionsOverview';
import MongodbInstanceSummary from './mongodbInstanceSummary';
import MongodbInstancesCompare from './mongodbInstancesCompare';
import MongodbOplogDetails from './mongodbOplogDetails';
import MongodbSearchDetails from './mongodbSearchDetails';
import MongodbSearchHealth from './mongodbSearchHealth';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';
import MongodbRouterSummaryDashboard from '@pages/dashboards/mongo/mongodbRouterSummary';
import MongodbShardedClusterSummary from '@pages/dashboards/mongo/mongodbShardedClusterSummary';
import MongodbReplSetSummary from '@pages/dashboards/mongo/mongodbReplSetSummary';

export const MongoDashboards = {
  backupDetails: new MongodbBackupDetails(),
  collectionsOverview: new MongodbCollectionsOverview(),
  instancesCompare: new MongodbInstancesCompare(),
  instanceSummary: new MongodbInstanceSummary(),
  oplogDetails: new MongodbOplogDetails(),
  replSetSummary: new MongodbReplSetSummary(),
  routerSummary: new MongodbRouterSummaryDashboard(),
  searchDetails: new MongodbSearchDetails(),
  searchHealth: new MongodbSearchHealth(),
  shardedClusterSummary: new MongodbShardedClusterSummary(),
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
