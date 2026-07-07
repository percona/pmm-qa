import DashboardInterface from '../../../interfaces/dashboard';
import NodeSummaryDashboard from './nodeSummary';

const OperatingSystemDashboards = {
  nodeSummary: new NodeSummaryDashboard(),
};

export type OperatingSystemDashboardsType = typeof OperatingSystemDashboards &
  Record<string, DashboardInterface>;

export default OperatingSystemDashboards;
