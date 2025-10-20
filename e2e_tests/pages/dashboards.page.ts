import { Page, expect } from '@playwright/test';

export default class Dashboards {
  constructor(private page: Page) {}

  private elements = {
    expandRow: '//*[@aria-label="Expand row"]',
    row: '//button[contains(@data-testid, "dashboard-row-title")]//ancestor::div[contains(@class, "react-grid-item")]',
    panelName: '//section[contains(@data-testid, "Panel header")]//h2',
    noDataPanel:
      '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data")]',
    noDataPanelName:
      '//*[(text()="No data") or (text()="NO DATA") or (text()="N/A") or (text()="-") or (text() = "No Data")]//ancestor::section//h2',
  };

  public async verifyAllPanelsHaveData(noDataMetrics: string[]) {
    const noDataPanels = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const noDataPanelComponents = await this.page
        .locator(this.elements.noDataPanel)
        .count();
      for (let j = 0; j < noDataPanelComponents; j++) {
        const noDataPanelName = await this.page
          .locator(this.elements.noDataPanelName)
          .nth(j)
          .textContent();
        if (noDataPanelName) {
          noDataPanels.add(noDataPanelName);
        }
      }

      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(500);

    const missingMetrics = Array.from(noDataPanels).filter(
      (e) => !noDataMetrics.includes(e),
    );

    expect
      .soft(missingMetrics, `Metrics without data are: ${missingMetrics}`)
      .toHaveLength(0);
  }

  public async verifyMetricsPresent(expectedMetrics: string[]) {
    const availableMetrics = await this.getAllAvailablePanels();

    const missingMetrics = expectedMetrics.filter(
      (e) => !availableMetrics.includes(e),
    );
    const unexpectedMetrics = availableMetrics.filter(
      (e) => !expectedMetrics.includes(e),
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

  public async expandAllRows() {
    await this.page
      .locator(this.elements.row)
      .first()
      .waitFor({ state: 'visible' });

    for (let i = 0; i < 20; i++) {
      const expandRows = await this.page
        .locator(this.elements.expandRow)
        .count();

      for (let j = 0; j < expandRows; j++) {
        await this.page.locator(this.elements.expandRow).nth(j).click();
      }

      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    await this.page.keyboard.press('Home');
    await this.page.waitForTimeout(500);
  }

  private async getAllAvailablePanels(): Promise<string[]> {
    const availableMetrics = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const numberOfPanels = await this.page
        .locator(this.elements.panelName)
        .count();
      for (let j = 0; j < numberOfPanels; j++) {
        const panelName = await this.page
          .locator(this.elements.panelName)
          .nth(j)
          .textContent();
        if (panelName) {
          availableMetrics.add(panelName);
        }
      }
      await this.page.keyboard.press('PageDown');
      await this.page.waitForTimeout(500);
    }

    return Array.from(availableMetrics);
  }
}
