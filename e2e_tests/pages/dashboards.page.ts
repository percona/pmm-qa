import { Page, expect } from '@playwright/test';
import { GrafanaPanel } from '../intefaces/grafanaPanel';
import TimeSeriesPanel from '../components/dashboards/panels/timeSeries.component';
import StatPanel from '../components/dashboards/panels/stat.component';
import BarGaugePanel from '../components/dashboards/panels/barGauge.component';

export default class Dashboards {
  private readonly page: Page;
  private readonly timeSeriesPanel: TimeSeriesPanel;
  private readonly statPanel: StatPanel;
  private readonly barGaugePanel: BarGaugePanel;

  constructor(page: Page) {
    this.page = page;
    this.timeSeriesPanel = new TimeSeriesPanel(this.page);
    this.statPanel = new StatPanel(this.page);
    this.barGaugePanel = new BarGaugePanel(this.page);
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
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data")]',
      ),
    noDataPanelName: () =>
      this.page.locator(
        '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data")]//ancestor::section//h2',
      ),
  };

  public async verifyAllPanelsHaveData(noDataMetrics: string[]) {
    const noDataPanels = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const noDataPanelComponents = await this.elements.noDataPanel().count();
      for (let j = 0; j < noDataPanelComponents; j++) {
        const noDataPanelName = await this.elements.noDataPanelName().nth(j).textContent();
        if (noDataPanelName) {
          noDataPanels.add(noDataPanelName);
        }
      }

      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(500);

    const missingMetrics = Array.from(noDataPanels).filter((e) => !noDataMetrics.includes(e));

    expect.soft(missingMetrics, `Metrics without data are: ${missingMetrics}`).toHaveLength(0);
  }

  public async verifyMetricsPresent(expectedMetrics: GrafanaPanel[]) {
    const availableMetrics = await this.getAllAvailablePanels();

    const missingMetrics = expectedMetrics.filter((e) => !availableMetrics.includes(e.name));
    const unexpectedMetrics = availableMetrics.filter(
      (e) => !expectedMetrics.map((metrics) => metrics.name).includes(e),
    );

    if (missingMetrics.length > 0 || unexpectedMetrics.length > 0) {
      const wrongMetrics = [...missingMetrics, ...unexpectedMetrics];
      let message = '';
      if (missingMetrics.length > 0) {
        message += `Missing metrics are: [${missingMetrics.join(', ')}]\n`;
      }
      if (unexpectedMetrics.length > 0) {
        message += `Unexpected metrics are: [${unexpectedMetrics.join(', ')}]\n`;
      }

      expect.soft(wrongMetrics, message.trim()).toHaveLength(0);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(500);
  }

  public expandAllRows = async () => {
    await this.elements.row().first().waitFor({ state: 'visible' });

    for (let i = 0; i < 20; i++) {
      console.log(`Getting expand rows ${i} times.`);
      const expandRows = await this.elements.expandRow().count();

      if (expandRows === 0) return;

      for (let j = 0; j < expandRows; j++) {
        await this.elements.expandRow().nth(j).click();
      }

      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(500);
  };

  private async getAllAvailablePanels(): Promise<string[]> {
    const availableMetrics = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const numberOfPanels = await this.elements.panelName().count();
      for (let j = 0; j < numberOfPanels; j++) {
        const panelName = await this.elements.panelName().nth(j).textContent();
        if (panelName) {
          availableMetrics.add(panelName);
        }
      }
      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    return Array.from(availableMetrics);
  }

  public verifyPanelValues = async (panels: GrafanaPanel[]) => {
    for (const panel of panels) {
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
        case 'unknown':
          break;
      }
    }
  };
}
