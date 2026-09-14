import DashboardInterface from '../../../interfaces/dashboard';
import NodeSummaryDashboard from './nodeSummary';
import NodesCompareDashboard from './nodesCompare';
import NodesOverviewDashboard from './nodesOverview';
import ProcessesDetailsDashboard from './processesDetails';

const OperatingSystemDashboards = {
  nodesCompare: new NodesCompareDashboard(),
  nodesOverview: new NodesOverviewDashboard(),
  nodeSummary: new NodeSummaryDashboard(),
  processesDetails: new ProcessesDetailsDashboard(),
};

export type OperatingSystemDashboardsType = typeof OperatingSystemDashboards &
  Record<string, DashboardInterface>;

export default OperatingSystemDashboards;
