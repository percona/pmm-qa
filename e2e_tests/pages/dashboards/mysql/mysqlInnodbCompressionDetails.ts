import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlInnoDBCompressionDetails implements DashboardInterface {
  constructor() {}
  url = 'graph/d/mysql-innodb-compression/mysql-innodb-compression-details';
  metrics: GrafanaPanel[] = [
    { name: 'InnoDB Compression level', type: 'stat' },
    { name: 'InnoDB Compression Failure Threshold', type: 'stat' },
    { name: 'Compression Failure Rate Threshold', type: 'stat' },
    { name: 'Write Pages to The Redo Log', type: 'stat' },
    { name: 'Compress Attempts', type: 'stat' },
    { name: 'Uncompressed Attempts', type: 'stat' },
    { name: 'Compression Success Ratio', type: 'stat' },
    { name: 'CPU Core Usage for Compression', type: 'stat' },
    { name: 'CPU Core Usage for Uncompression', type: 'stat' },
    { name: 'Total Used Pages', type: 'stat' },
    { name: 'Total Free Pages', type: 'stat' },
    { name: 'Used Pages (Buffer Pull 0)', type: 'stat' },
    { name: 'Pages Free (Buffer Pull 0)', type: 'stat' },
    { name: 'Buffer Pool Size', type: 'stat' },
    { name: 'Buffer Pool Size of Total RAM', type: 'stat' },
    { name: 'Total Redo Log Space', type: 'stat' },
    { name: 'Max Log Space Used', type: 'stat' },
    { name: 'Max Transaction History Length', type: 'stat' },
    { name: 'Data Bandwidth', type: 'stat' },
    { name: 'Fsync Rate', type: 'stat' },
    { name: 'Row Lock Blocking', type: 'stat' },
  ];

  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
