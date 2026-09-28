import DashboardInterface from '@interfaces/dashboard';
import MongodbInstanceSummary from './mongodbInstanceSummary';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';

export const MongoDashboards = {
  instanceSummary: new MongodbInstanceSummary(),
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
