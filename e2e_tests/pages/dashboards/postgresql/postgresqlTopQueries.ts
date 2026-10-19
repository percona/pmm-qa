import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';

export default class PostgresqlTopQueriesDashboard implements DashboardInterface {
  url = 'graph/d/postgresql-top-queries/postgresql-top-queries';
  metrics: GrafanaPanel[] = [
    { name: 'Transactions per Seconds', type: 'timeSeries' },
    { name: 'Top 10 Slowest Query', type: 'table' },
    { name: 'Top 10 time spent', type: 'table' },
    { name: 'Top 10 Queries Executed the most', type: 'table' },
    { name: 'Top 10 Queries writing the most', type: 'table' },
    { name: 'Top 10 Queries Affected the most rows', type: 'table' },
    { name: 'Top 10 User Executed the most queries', type: 'table' },
    { name: 'Top 10 CPU Intensive Queries', type: 'table' },
    { name: 'Top 10 Memory Intensive Queries', type: 'table' },
    { name: 'Top 10 Queries by I/O Wait', type: 'table' },
    { name: 'Top 10 Queries by Shared Block Reads (Sequential Scan Indicator)', type: 'table' },
  ];
  noDataMetrics: string[] = [];
}
