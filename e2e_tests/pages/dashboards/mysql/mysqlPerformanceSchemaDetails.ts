import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class MysqlPerformanceSchemaDetails implements DashboardInterface {
  url = 'graph/d/mysql-performance-schema/mysql-performance-schema-details';
  // Primary memory panel: mysql_perf_schema_memory_events_used_bytes. Populated whenever
  // memory instruments are enabled server-side (default on PS/MySQL 8.0+), so it must
  // render real data end-to-end (collector -> VictoriaMetrics -> panel).
  memoryCurrentUsedPanel = 'Memory Usage — Current Bytes Used (Top 15 by Event)';
  // Panels added in PMM-12279 (perf_schema.memory_events collector -> memory panels).
  // Names are copied verbatim from the dashboard JSON; the first one uses an em dash (U+2014).
  memoryMetrics: GrafanaPanel[] = [
    { name: 'Memory Usage — Current Bytes Used (Top 15 by Event)', type: 'timeSeries' },
    { name: 'Memory Allocation Rate (Top 10 by Event)', type: 'timeSeries' },
    { name: 'Memory Free Rate (Top 10 by Event)', type: 'timeSeries' },
  ];
  metrics: GrafanaPanel[] = [
    { name: 'Performance Schema File IO (Events)', type: 'timeSeries' },
    { name: 'Performance Schema File IO (Load)', type: 'timeSeries' },
    { name: 'Performance Schema File IO (Bytes)', type: 'timeSeries' },
    { name: 'Performance Schema Status Variables (Events)', type: 'timeSeries' },
    { name: 'Performance Schema Waits (Events)', type: 'timeSeries' },
    { name: 'Performance Schema Waits (Load)', type: 'timeSeries' },
    { name: 'Index Access Operations (Load)', type: 'timeSeries' },
    { name: 'Table Access Operations (Load)', type: 'timeSeries' },
    { name: 'Performance Schema SQL & External Locks (Events)', type: 'timeSeries' },
    { name: 'Performance Schema SQL and External Locks (Seconds)', type: 'timeSeries' },
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
    ...this.memoryMetrics,
  ];
  // The two rate panels only plot series whose alloc/free rate is > 0, so under low load
  // they can legitimately be empty. They are allow-listed here for any full-dashboard
  // verifyAllPanelsHaveData() check; the feature test asserts data on memoryCurrentUsedPanel.
  noDataMetrics: string[] = [
    'Memory Allocation Rate (Top 10 by Event)',
    'Memory Free Rate (Top 10 by Event)',
  ];
  metricsWithData = this.metrics.filter((metric) => !this.noDataMetrics.includes(metric.name));
}
