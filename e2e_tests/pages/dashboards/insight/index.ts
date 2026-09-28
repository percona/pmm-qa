import DashboardInterface from '@interfaces/dashboard';
import AdvancedDataExplorationDashboard from '@pages/dashboards/insight/advancedDataExploration';
import PrometheusExporterStatusDashboard from '@pages/dashboards/insight/prometheusExporterStatus';
import PrometheusExportersOverviewDashboard from '@pages/dashboards/insight/prometheusExportersOverview';
import VictoriaMetricsDashboard from '@pages/dashboards/insight/victoriaMetrics';
import VictoriaMetricsAgentsOverviewDashboard from '@pages/dashboards/insight/victoriaMetricsAgentsOverview';

export const InsightDashboards = {
  advancedDataExploration: new AdvancedDataExplorationDashboard(),
  prometheusExportersOverview: new PrometheusExportersOverviewDashboard(),
  prometheusExporterStatus: new PrometheusExporterStatusDashboard(),
  victoriaMetrics: new VictoriaMetricsDashboard(),
  victoriaMetricsAgentsOverview: new VictoriaMetricsAgentsOverviewDashboard(),
};

export type InsightDashboardsType = typeof InsightDashboards & Record<string, DashboardInterface>;

export default InsightDashboards;
