import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MysqlCommandHandlerCountersCompare {
  constructor() {}

  url = 'graph/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare';
  metrics: (serviceName: string) => GrafanaPanel[] = (serviceName: string): GrafanaPanel[] => [
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

  noDataMetrics: string[] = [];
  metricsWithData = (serviceName: string) =>
    this.metrics(serviceName).filter((metric) => !this.noDataMetrics.includes(metric.name));
}
