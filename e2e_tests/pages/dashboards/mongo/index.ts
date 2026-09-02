import DashboardInterface from '@interfaces/dashboard';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';

export const MongoDashboards = {
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
