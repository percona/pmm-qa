import DashboardInterface from '@interfaces/dashboard';
import MongodbUnusedIndexes from './mongodbUnusedIndexes';
import MongodbRouterSummaryDashboard from '@pages/dashboards/mongo/mongodbRouterSummary';

export const MongoDashboards = {
  routerSummary: new MongodbRouterSummaryDashboard(),
  unusedIndexes: new MongodbUnusedIndexes(),
};

export type MongoDashboardsType = typeof MongoDashboards & Record<string, DashboardInterface>;

export default MongoDashboards;
