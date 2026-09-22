import DashboardInterface from '@interfaces/dashboard';
import AdvancedDataExplorationDashboard from '@pages/dashboards/insight/advancedDataExploration';
import PrometheusExporterStatusDashboard from '@pages/dashboards/insight/prometheusExporterStatus';
import PrometheusExportersOverviewDashboard from '@pages/dashboards/insight/prometheusExportersOverview';

export const InsightDashboards = {
  advancedDataExploration: new AdvancedDataExplorationDashboard(),
  prometheusExportersOverview: new PrometheusExportersOverviewDashboard(),
  prometheusExporterStatus: new PrometheusExporterStatusDashboard(),
};

export type InsightDashboardsType = typeof InsightDashboards & Record<string, DashboardInterface>;

export default InsightDashboards;
