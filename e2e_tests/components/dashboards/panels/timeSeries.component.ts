import { Page, Locator } from '@playwright/test';
import PanelComponent from './panel.component';

export default class TimeSeriesPanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    timeSeriesPanelValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]//ancestor::tr/td[position() >= 2 and position() <= last()]`,
      ),
    legendLabels: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]`,
      ),
    legendColor: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid='series-icon']`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.timeSeriesPanelValues(panelName), panelName);
  };

  private getUniqueValues = async (locator: Locator, getValue: (element: Locator) => Promise<string>) => {
    const count = await locator.count();
    const values = new Set<string>();
    for (let i = 0; i < count; i++) {
      const val = await getValue(locator.nth(i));
      values.add(val);
    }
    return { values, count };
  }

  public getSeriesColorsAndLabels = async (panelName: string) => {
    const panel = this.grafanaIframe().locator(
      `//section[@data-testid="data-testid Panel header ${panelName}"]`,
    );
    await panel.scrollIntoViewIfNeeded();

    // Colors
    const colorIndicator = this.elements.legendColor(panelName);
    const { values: colors, count: seriesCount } = await this.getUniqueValues(colorIndicator, async (el) => {
      await el.scrollIntoViewIfNeeded();
      return el.evaluate((el) => {
        return el.style.backgroundColor;
      });
    });

    // Labels
    const legendLabels = this.elements.legendLabels(panelName);
    const { values: labels, count: labelCount } = await this.getUniqueValues(legendLabels, async (el) => {
      const text = await el.textContent();
      return text?.trim() || '';
    });

    return { colors, labels, seriesCount, labelCount };
  };
}