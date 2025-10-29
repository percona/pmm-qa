import { expect, Page } from '@playwright/test';

export default class TimeSeriesPanel {
  constructor(private page: Page) {}

  private elements = {
    timeSeriesPanelValues: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]//ancestor::tr/td[position() >= 2 and position() <= last()]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.timeSeriesPanelValues(panelName).first().waitFor({ state: 'visible' });
    const countOfValues = await this.elements.timeSeriesPanelValues(panelName).count();

    expect.soft(countOfValues, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfValues; i++) {
      const text = await this.elements.timeSeriesPanelValues(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
