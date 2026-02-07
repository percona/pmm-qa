import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlCommandHandlerCountersCompare implements DashboardInterface {
  url = 'graph/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare';
  noDataMetrics: string[] = [];

  metrics = (serviceName: string): GrafanaPanel[] => [
    { name: serviceName, type: 'unknown' },
    { name: `${serviceName} - alter_table`, type: 'timeSeries' },
    { name: `${serviceName} - delete`, type: 'timeSeries' },
    { name: `${serviceName} - insert`, type: 'timeSeries' },
    { name: `${serviceName} - replace`, type: 'timeSeries' },
    { name: `${serviceName} - select`, type: 'timeSeries' },
    { name: `${serviceName} - update`, type: 'timeSeries' },

    { name: `${serviceName} - commit`, type: 'timeSeries' },
    { name: `${serviceName} - delete`, type: 'timeSeries' },
    { name: `${serviceName} - update`, type: 'timeSeries' },
    { name: `${serviceName} - write`, type: 'timeSeries' },
  ];

  metricsWithData = (serviceName: string) =>
    this.metrics(serviceName).filter((metric) => !this.noDataMetrics.includes(metric.name));
}
