import { Page, expect, test } from '@playwright/test';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { GetService } from '@interfaces/inventory';
import { replaceWildcards } from '@helpers/metrics.helper';
import TimeSeriesPanel from '@components/dashboards/panels/timeSeries.component';
import StatPanel from '@components/dashboards/panels/stat.component';
import BarGaugePanel from '@components/dashboards/panels/barGauge.component';
import PolyStatPanel from '@components/dashboards/panels/polyStat.component';
import TablePanel from '@components/dashboards/panels/table.component';
import MysqlInstanceOverview from '@pages/dashboards/mysql/mysqlInstanceOverview';
import {
  ValkeyClientsDashboard,
  ValkeyClusterDetailsDashboard,
  ValkeyCommandDetailDashboard,
  ValkeyLoadDashboard,
  ValkeyMemoryDashboard,
  ValkeyNetworkDashboard,
  ValkeyOverviewDashboard,
  ValkeyPersistenceDetailsDashboard,
  ValkeyReplicationDashboard,
  ValkeySlowlogDashboard,
} from '@valkey';
import { Timeouts } from '@helpers/timeouts';
import TextPanel from '@components/dashboards/panels/text.component';
import MysqlDashboards from '@pages/dashboards/mysql/mysql.dashboards';
import StateTimePanel from '@components/dashboards/panels/stateTime.component';
import BarTimePanel from '@components/dashboards/panels/barTime.component';

export const valkeyDashboards = {
  'Valkey Overview': new ValkeyOverviewDashboard(),
  'Valkey Clients': new ValkeyClientsDashboard(),
  'Valkey Cluster Details': new ValkeyClusterDetailsDashboard(),
  'Valkey Command Detail': new ValkeyCommandDetailDashboard(),
  'Valkey Load': new ValkeyLoadDashboard(),
  'Valkey Memory': new ValkeyMemoryDashboard(),
  'Valkey Network': new ValkeyNetworkDashboard(),
  'Valkey Persistence Details': new ValkeyPersistenceDetailsDashboard(),
  'Valkey Replication': new ValkeyReplicationDashboard(),
  'Valkey Slowlog': new ValkeySlowlogDashboard(),
} as const;

export default class Dashboards {
  private readonly page: Page;
  private readonly timeSeriesPanel: TimeSeriesPanel;
  private readonly statPanel: StatPanel;
  private readonly barGaugePanel: BarGaugePanel;
  private readonly barTimePanel: BarTimePanel;
  private readonly polyStatPanel: PolyStatPanel;
  private readonly tablePanel: TablePanel;
  private readonly textPanel: TextPanel;
  private readonly stateTime: StateTimePanel;
  // MySQL dashboards
  readonly mysql: MysqlDashboards;
  readonly mysqlInstanceOverview: MysqlInstanceOverview;
  // Valkey dashboards
  readonly valkeyDashboards: Record<string, any> = valkeyDashboards;

  constructor(page: Page) {
    this.page = page;
    this.timeSeriesPanel = new TimeSeriesPanel(this.page);
    this.statPanel = new StatPanel(this.page);
    this.barGaugePanel = new BarGaugePanel(this.page);
    this.barTimePanel = new BarTimePanel(this.page);
    this.polyStatPanel = new PolyStatPanel(this.page);
    this.tablePanel = new TablePanel(this.page);
    this.mysqlInstanceOverview = new MysqlInstanceOverview();
    this.textPanel = new TextPanel(this.page);
    this.stateTime = new StateTimePanel(this.page);
    this.mysql = new MysqlDashboards();
  }

  private elements = {
    expandRow: () => this.page.getByLabel('Expand row'),
    panelName: () => this.page.locator('//section[contains(@data-testid, "Panel header")]//h2'),
    noDataPanel: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]',
      ),
    noDataPanelName: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]//ancestor::section//h2',
      ),
    refreshButton: () => this.page.getByLabel('Refresh', { exact: true }),
    loadingIndicator: () => this.page.getByLabel('data-testid Loading indicator', { exact: true }),
    loadingText: () => this.page.getByText('Loading plugin panel...', { exact: true }),
    loadingBar: () => this.page.getByLabel('Panel loading bar'),
    gridItems: () => this.page.locator('.react-grid-item'),
    summaryPanelText: () =>
      this.page.locator(
        '//pre[@data-testid="pt-summary-fingerprint" and contains(text(), "Percona Toolkit MySQL Summary Report")]',
      ),
  };

  private async loadAllPanels() {
    const expectPanel = expect.configure({ timeout: Timeouts.ONE_MINUTE });
    // Wait for the dashboard to be visible before proceeding.
    await test.step('Wait for initial loading to finish', async () => {
      await expectPanel(this.elements.refreshButton()).toBeVisible();
      await expectPanel(this.elements.loadingIndicator()).toHaveCount(0);
      await expectPanel(this.elements.loadingText()).toHaveCount(0);
    });

    // Expand rows if present and wait for content in each item.
    await test.step('Expand rows and load panel content', async () => {
      for (let i = 0; i < (await this.elements.gridItems().count()); i++) {
        const item = this.elements.gridItems().nth(i);
        await item.scrollIntoViewIfNeeded();

        const expandButton = item.getByLabel('Expand row');
        if (await expandButton.isVisible()) {
          await expandButton.click();
        }

        await expectPanel(item.locator(':scope > *')).not.toHaveCount(0);
      }
    });

    // Confirms that there are no remaining loading bars.
    await test.step('Wait for loading to finish', async () => {
      await expectPanel(this.elements.loadingBar()).toHaveCount(0);
    });
  }

  async verifyAllPanelsHaveData(noDataMetrics: string[]) {
    await this.loadAllPanels();
    const noDataPanels = await this.elements.noDataPanelName().allTextContents();
    const missingMetrics = Array.from(noDataPanels).filter((e) => !noDataMetrics.includes(e));
    const extraMetrics = noDataMetrics.filter((e) => !noDataPanels.includes(e));

    expect.soft(missingMetrics, `Metrics without data are: ${missingMetrics}`).toHaveLength(0);
    expect
      .soft(extraMetrics, `Metrics with data that are expected to be empty are: ${extraMetrics}`)
      .toHaveLength(0);
  }

  async verifyMetricsPresent(expectedMetrics: GrafanaPanel[], serviceList?: GetService[]) {
    expectedMetrics = serviceList ? replaceWildcards(expectedMetrics, serviceList) : expectedMetrics;
    const expectedMetricsNames = expectedMetrics.map((e) => e.name);
    await this.loadAllPanels();
    const availableMetrics = await this.elements.panelName().allTextContents();

    expect(availableMetrics.sort()).toEqual(expectedMetricsNames.sort());
  }

  async verifyPanelValues(panels: GrafanaPanel[], serviceList?: GetService[]) {
    await this.loadAllPanels();
    const panelList = serviceList ? replaceWildcards(panels, serviceList) : panels;
    for (const panel of panelList) {
      switch (panel.type) {
        case 'timeSeries':
          await this.timeSeriesPanel.verifyPanelData(panel.name);
          break;
        case 'stat':
          await this.statPanel.verifyPanelData(panel.name);
          break;
        case 'barGauge':
          await this.barGaugePanel.verifyPanelData(panel.name);
          break;
        case 'barTime':
          await this.barTimePanel.verifyPanelData(panel.name);
          break;
        case 'polyStat':
          await this.polyStatPanel.verifyPanelData(panel.name);
          break;
        case 'table':
          await this.tablePanel.verifyPanelData(panel.name);
          break;
        case 'text':
          await this.textPanel.verifyPanelData(panel.name);
          break;
        case 'stateTime':
          await this.stateTime.verifyPanelData(panel.name);
          break;
        case 'summary':
          await this.elements.summaryPanelText().waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });
          break;
        case 'unknown':
        case 'empty':
          break;
        default:
          throw new Error(`Unsupported panel: ${panel.name}`);
      }
    }
  }
}
