import { Page, expect } from '@playwright/test';
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
  private readonly polyStatPanel: PolyStatPanel;
  private readonly tablePanel: TablePanel;
  // MySQL dashboards
  readonly mysqlInstanceOverview: MysqlInstanceOverview;
  // Valkey dashboards
  readonly valkeyDashboards: Record<string, any> = valkeyDashboards;

  constructor(page: Page) {
    this.page = page;
    this.timeSeriesPanel = new TimeSeriesPanel(this.page);
    this.statPanel = new StatPanel(this.page);
    this.barGaugePanel = new BarGaugePanel(this.page);
    this.polyStatPanel = new PolyStatPanel(this.page);
    this.tablePanel = new TablePanel(this.page);
    this.mysqlInstanceOverview = new MysqlInstanceOverview();
  }

  private elements = {
    expandRow: () => this.page.locator('//*[@aria-label="Expand row"]'),
    row: () =>
      this.page.locator(
        '//button[contains(@data-testid, "dashboard-row-title")]//ancestor::div[contains(@class, "react-grid-item")]',
      ),
    panelName: () => this.page.locator('//section[contains(@data-testid, "Panel header")]//h2'),
    noDataPanel: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]',
      ),
    noDataPanelName: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]//ancestor::section//h2',
      ),
    rowByName: (rowName: string) =>
      this.page.locator(
        `//button[contains(@data-testid, "dashboard-row-title") and contains(@data-testid, "${rowName}")]`,
      ),
    loadingBar: () => this.page.getByLabel('Panel loading bar'),
    gridItems: () => this.page.locator('.react-grid-item'),
  };

  public async loadAllPanels() {
    await this.expandAllRows();

    const items = this.elements.gridItems();
    const totalItems = await items.count();

    // Open every item and wait until the item has at least one child, indicating content started to load.
    for (let i = 0; i < totalItems; i++) {
      const item = items.nth(i);
      await item.scrollIntoViewIfNeeded();
      await expect
        .poll(async () => await item.locator(':scope > *').count(), { timeout: Timeouts.ONE_MINUTE })
        .toBeGreaterThan(0);
    }

    // Confirm no loading bars remain.
    await expect
      .poll(async () => await this.elements.loadingBar().count(), {
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBe(0);
  }

  public async verifyAllPanelsHaveData(noDataMetrics: string[]) {
    const noDataPanels = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const noDataPanelNames = await this.elements.noDataPanelName().allTextContents();
      noDataPanelNames.forEach((panelName: string) => noDataPanels.add(panelName));

      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(Timeouts.HALF_SECOND);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(Timeouts.HALF_SECOND);

    const missingMetrics = Array.from(noDataPanels).filter((e) => !noDataMetrics.includes(e));
    const extraMetrics = noDataMetrics.filter((e) => !noDataPanels.has(e));

    expect.soft(missingMetrics, `Metrics without data are: ${missingMetrics}`).toHaveLength(0);
    expect
      .soft(extraMetrics, `Metrics with data that are expected to be empty are: ${extraMetrics}`)
      .toHaveLength(0);
  }

  public async verifyMetricsPresent(expectedMetrics: GrafanaPanel[], serviceList?: GetService[]) {
    expectedMetrics = serviceList ? replaceWildcards(expectedMetrics, serviceList) : expectedMetrics;
    const expectedMetricsNames = expectedMetrics.map((e) => e.name);
    await this.page.keyboard.press('Home');
    const availableMetrics = await this.getAllAvailablePanels();

    expect(availableMetrics.sort()).toEqual(expectedMetricsNames.sort());

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(Timeouts.HALF_SECOND);
  }

  expandAllRows = async () => {
    await this.elements.row().first().waitFor({ state: 'visible' });
    await this.page.keyboard.press('End');
    await this.page.waitForTimeout(Timeouts.ONE_SECOND);
    const rowsName = await this.elements.expandRow().allTextContents();

    for (const rowName of rowsName) {
      await this.elements.rowByName(rowName).click();
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(Timeouts.ONE_SECOND);
  };

  private async getAllAvailablePanels(): Promise<string[]> {
    const availableMetrics = new Set<string>();

    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
      (await this.elements.panelName().allTextContents()).forEach((availableMetric) =>
        availableMetrics.add(availableMetric),
      );
    }

    return Array.from(availableMetrics.values());
  }

  public verifyPanelValues = async (panels: GrafanaPanel[], serviceList?: GetService[]) => {
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
        case 'polyStat':
          await this.polyStatPanel.verifyPanelData(panel.name);
          break;
        case 'table':
          await this.tablePanel.verifyPanelData(panel.name);
          break;
        case 'unknown':
          break;
        default:
          throw new Error(`Unsupported panel: ${panel.name}`);
      }
    }
  };
}
