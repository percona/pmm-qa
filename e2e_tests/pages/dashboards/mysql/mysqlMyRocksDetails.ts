import { GrafanaPanel } from '@interfaces/grafanaPanel';

export default class MysqlMyRocksDetails {
  constructor() {}

  url = 'graph/d/mysql-myrocks/mysql-myrocks-details';
  metrics: GrafanaPanel[] = [
    { name: 'MyRocks Cache', type: 'timeSeries' },
    { name: 'MyRocks Cache Data Bytes R/W', type: 'timeSeries' },
    { name: 'MyRocks Cache Index Hit Rate', type: 'timeSeries' },
    { name: 'MyRocks Cache Index', type: 'timeSeries' },
    { name: 'MyRocks Cache Filter Hit Rate', type: 'timeSeries' },
    { name: 'MyRocks Cache Filter', type: 'timeSeries' },
    { name: 'MyRocks Cache Data Bytes Inserted', type: 'timeSeries' },
    { name: 'MyRocks Bloom Filter', type: 'timeSeries' },
    { name: 'MyRocks Memtable', type: 'timeSeries' },
    { name: 'Memtable Size', type: 'timeSeries' },
    { name: 'MyRocks Number Of Keys', type: 'timeSeries' },
    { name: 'MyRocks Cache L0/L1', type: 'timeSeries' },
    { name: 'MyRocks Number of DB ops', type: 'timeSeries' },
    { name: 'MyRocks R/W', type: 'timeSeries' },
    { name: 'MyRocks Bytes Read by Iterations', type: 'timeSeries' },
    { name: 'MyRocks Write ops', type: 'timeSeries' },
    { name: 'MyRocks WAL', type: 'timeSeries' },
    { name: 'MyRocks Number Reseeks in Iterations', type: 'timeSeries' },
    { name: 'RocksDB Row Operations', type: 'timeSeries' },
    { name: 'MyRocks File Operations', type: 'timeSeries' },
    { name: 'RocksDB Stalls', type: 'timeSeries' },
    { name: 'RocksDB Stops/Slowdowns', type: 'timeSeries' },
    { name: 'MySQL Uptime', type: 'stat' },
    { name: 'Version', type: 'text' },
    { name: 'Current QPS', type: 'stat' },
    { name: 'File Handlers Used', type: 'stat' },
    { name: 'Table Open Cache Miss Ratio', type: 'stat' },
    { name: 'Table Open Cache Size', type: 'stat' },
    { name: 'Table Definition Cache Size', type: 'stat' },
    { name: 'Service', type: 'text' },
    { name: 'MySQL Connections', type: 'timeSeries' },
    { name: 'MySQL Client Thread Activity', type: 'timeSeries' },
    { name: 'MySQL Handlers', type: 'timeSeries' },
    { name: 'Top Command Counters', type: 'timeSeries' },
    { name: 'Process States', type: 'timeSeries' },
    { name: 'MySQL Network Traffic', type: 'timeSeries' },
    { name: 'System Uptime', type: 'stat' },
    { name: 'Load Average', type: 'stat' },
    { name: 'RAM', type: 'stat' },
    { name: 'Memory Available', type: 'stat' },
    { name: 'Virtual Memory', type: 'stat' },
    { name: 'Disk Space', type: 'stat' },
    { name: 'Min Space Available', type: 'stat' },
    { name: 'Node', type: 'text' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'CPU Saturation and Max Core Usage', type: 'timeSeries' },
    { name: 'Disk I/O and Swap Activity', type: 'timeSeries' },
    { name: 'Network Traffic', type: 'timeSeries' },
  ];

  noDataMetrics: string[] = [];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
