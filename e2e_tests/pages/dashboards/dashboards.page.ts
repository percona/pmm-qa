import { Page, expect, test } from '@playwright/test';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { GetService } from '@interfaces/inventory';
import { replaceWildcards } from '@helpers/metrics.helper';
import TimeSeriesPanel from '@components/dashboards/panels/timeSeries.component';
import StatPanel from '@components/dashboards/panels/stat.component';
import BarGaugePanel from '@components/dashboards/panels/barGauge.component';
import PolyStatPanel from '@components/dashboards/panels/polyStat.component';
import TablePanel from '@components/dashboards/panels/table.component';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';
import ValkeyDashboards from '@valkey';
import MysqlDashboards from '@pages/dashboards/mysql';
import DashboardInterface from '@interfaces/dashboard';

export default class Dashboards extends BasePage {
  private readonly timeSeriesPanel: TimeSeriesPanel;
  private readonly statPanel: StatPanel;
  private readonly barGaugePanel: BarGaugePanel;
  private readonly polyStatPanel: PolyStatPanel;
  private readonly tablePanel: TablePanel;
  // MySQL dashboards
  readonly mysql: Record<string, DashboardInterface>;
  readonly valkey: Record<string, DashboardInterface>;

  constructor(page: Page) {
    super(page);
    this.page = page;
    this.timeSeriesPanel = new TimeSeriesPanel(this.page);
    this.statPanel = new StatPanel(this.page);
    this.barGaugePanel = new BarGaugePanel(this.page);
    this.polyStatPanel = new PolyStatPanel(this.page);
    this.tablePanel = new TablePanel(this.page);
    this.mysql = MysqlDashboards;
    this.valkey = ValkeyDashboards;
  }

  private elements = {
    expandRow: () => this.grafanaIframe().getByLabel('Expand row'),
    panelName: () => this.grafanaIframe().locator('//section[contains(@data-testid, "Panel header")]//h2'),
    noDataPanel: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]',
      ),
    noDataPanelName: () =>
      this.grafanaIframe().locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data") or (@data-testid="data-testid Panel data error message")]//ancestor::section//h2',
      ),
    refreshButton: () => this.grafanaIframe().getByLabel('Refresh', { exact: true }),
    loadingIndicator: () => this.grafanaIframe().getByLabel('data-testid Loading indicator', { exact: true }),
    loadingText: () => this.grafanaIframe().getByText('Loading plugin panel...', { exact: true }),
    loadingBar: () => this.grafanaIframe().getByLabel('Panel loading bar'),
    gridItems: () => this.grafanaIframe().locator('.react-grid-item'),
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
  }
}
