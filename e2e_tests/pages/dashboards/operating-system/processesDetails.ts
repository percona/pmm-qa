import DashboardInterface from '@interfaces/dashboard';

export default class ProcessesDetailsDashboard implements DashboardInterface {
  url = 'graph/d/node-cpu-process/processes-details';
  metrics = [];
  noDataMetrics = [];
}
