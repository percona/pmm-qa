import DashboardInterface from '../../../interfaces/dashboard';
import DiskDetailsDashboard from './diskDetails';
import MemoryDetailsDashboard from './memoryDetails';
import NetworkDetailsDashboard from './networkDetails';
import NodeSummaryDashboard from './nodeSummary';
import NodesCompareDashboard from './nodesCompare';
import NodesOverviewDashboard from './nodesOverview';
import ProcessesDetailsDashboard from './processesDetails';

const OperatingSystemDashboards = {
  diskDetails: new DiskDetailsDashboard(),
  memoryDetails: new MemoryDetailsDashboard(),
  networkDetails: new NetworkDetailsDashboard(),
  nodesCompare: new NodesCompareDashboard(),
  nodesOverview: new NodesOverviewDashboard(),
  nodeSummary: new NodeSummaryDashboard(),
  processesDetails: new ProcessesDetailsDashboard(),
};

export type OperatingSystemDashboardsType = typeof OperatingSystemDashboards &
  Record<string, DashboardInterface>;

export default OperatingSystemDashboards;
