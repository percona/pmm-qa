import DashboardInterface from '@interfaces/dashboard';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { expect, Locator } from '@playwright/test';
import Dashboards from '@pages/dashboards/dashboards.page';

export default class MongodbClusterSyncDetails implements DashboardInterface {
  url = 'graph/d/mongodb-clustersync-details/mongodb-clustersync-details';
  // Source and target columns share these titles: the first panel is the source's, the last the target's.
  clusterStats = ['Members Down', 'Max Node CPU', 'Internal Replication Lag'];
  metrics: GrafanaPanel[] = [
    { name: 'Lag Time', type: 'timeSeries' },
    { name: 'Change Events Rate', type: 'timeSeries' },
    { name: 'Operations', type: 'timeSeries' },
    { name: 'Operation Latency', type: 'timeSeries' },
  ];
  noDataMetrics: string[] = [];
  pipelineMetrics: GrafanaPanel[] = [
    { name: 'Dispatcher Queue', type: 'timeSeries' },
    { name: 'Worker Event Queues', type: 'timeSeries' },
    { name: 'Worker Bulk Queues', type: 'timeSeries' },
    { name: 'Worker Events Applied', type: 'timeSeries' },
    { name: 'Flush Duration (p99)', type: 'timeSeries' },
    { name: 'Flush Batch Size (p99)', type: 'timeSeries' },
  ];
  processPanels = [
    'CPU Usage',
    'Resident Memory',
    'File Descriptors',
    'Goroutines and Threads',
    'Go Heap',
    'GC Pause Duration',
  ];
  progressMetrics: GrafanaPanel[] = [
    { name: 'Copied vs Estimated Size', type: 'timeSeries' },
    { name: 'Copy Throughput', type: 'timeSeries' },
    { name: 'Documents Copied per Second', type: 'timeSeries' },
    { name: 'Batch Duration', type: 'timeSeries' },
    { name: 'Lag vs Source Oplog Window', type: 'timeSeries' },
  ];
  rows = {
    health: '1 · Is the migration healthy?',
    howTo: 'How to use this dashboard',
    instances: '4 · Are the ClusterSync instances healthy?',
    pipeline: '3 · Why is replication slow or stuck?',
    progress: '2 · Is replication progressing?',
  };
  title = 'MongoDB ClusterSync Details';
  private unitSeconds: Record<string, number> = { min: 60, mins: 60, ms: 0.001, ns: 1e-9, s: 1, µs: 1e-6 };

  convertToSeconds = (text: string) => {
    const match = /(-?[\d.]+)\s*(mins?|ms|µs|ns|s)\b/.exec(text);

    if (!match) throw new Error(`No duration in "${text}"`);

    return Number(match[1]) * this.unitSeconds[match[2]];
  };

  panelText = async (panel: Locator) => {
    await panel.scrollIntoViewIfNeeded();

    return (await panel.innerText()).trim();
  };

  perWorkerPanels = (serviceName: string) => [
    `Worker Event Queue - ${serviceName}`,
    `Worker Events Applied - ${serviceName}`,
    `Worker Flush Duration (p99) - ${serviceName}`,
  ];

  statText = async (dashboard: Dashboards, panelName: string, index = 0) =>
    this.panelText(dashboard.builders.panelContentByExactName(panelName).nth(index));

  verifyClusterHealth = async (dashboard: Dashboards) => {
    for (const panelName of dashboard.mongo.clusterSyncDetails.clusterStats) {
      await expect(dashboard.builders.panelContentByExactName(panelName)).toHaveCount(2);

      for (const index of [0, 1]) {
        expect(await this.statText(dashboard, panelName, index), `${panelName} must show a value`).toMatch(
          /^[\d.]+\s*\S*$/,
        );
      }
    }

    expect(await this.statText(dashboard, 'Members Down', 0)).toBe('0');
    expect(await this.statText(dashboard, 'Members Down', 1)).toBe('0');
    expect(this.convertToSeconds(await this.statText(dashboard, 'Oplog Window'))).toBeGreaterThan(0);
    expect(await this.statText(dashboard, 'Disk Space Used')).toMatch(/^[\d.]+%$/);
  };
}
