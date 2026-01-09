import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MySQLInstancesCompare implements DashboardInterface {
  constructor() {}

  url = 'graph/d/mysql-instance-compare/mysql-instances-compare';
  metrics: (serviceName: string) => GrafanaPanel[] = (serviceName: string): GrafanaPanel[] => [
    { name: `${serviceName} - Service Info`, type: 'table' },
    { name: `${serviceName} - MySQL Uptime`, type: 'stat' },
    { name: `${serviceName} - Current QPS`, type: 'stat' },
    { name: `${serviceName} - DB Connections`, type: 'stat' },
    { name: `${serviceName} - InnoDB Buffer Pool Size`, type: 'stat' },
    { name: `${serviceName} - Buffer Pool Size of Total RAM`, type: 'stat' },
    { name: `${serviceName} - MySQL Connections`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Aborted Connections`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Questions`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Client Thread Activity`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Thread Cache`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Temporary Objects`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Select Types`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Slow Queries`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Sorts`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Table Locks`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Network Traffic`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Network Usage Hourly`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Internal Memory Overview`, type: 'timeSeries' },
    { name: `${serviceName} Top Command Counters`, type: 'timeSeries' },
    { name: `${serviceName} - Top Command Counters Hourly`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Handlers`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Transaction Handlers`, type: 'timeSeries' },
    { name: `${serviceName} - Process States`, type: 'timeSeries' },
    { name: `T${serviceName} - Top 5 Process States Hourly`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Query Cache Memory`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Query Cache Activity`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL File Openings`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Open Files`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Table Open Cache Status`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Open Tables`, type: 'timeSeries' },
    { name: `${serviceName} - MySQL Table Definition Cache`, type: 'timeSeries' },
  ];
  noDataMetrics: (serviceName: string) => string[] = (serviceName: string) => [
    `T${serviceName} - Top 5 Process States Hourly`,
    `${serviceName} - Top Command Counters Hourly`,
    `${serviceName} - MySQL Network Usage Hourly`,
    `${serviceName} - Buffer Pool Size of Total RAM`,
    `${serviceName} - MySQL Query Cache Memory`,
    `${serviceName} - MySQL Query Cache Activity`,
  ];

  metricsWithData = (serviceName: string) =>
    this.metrics(serviceName).filter((metric) => !this.noDataMetrics(serviceName).includes(metric.name));
}
