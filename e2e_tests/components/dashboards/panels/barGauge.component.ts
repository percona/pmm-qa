import { expect, Page } from '@playwright/test';

export default class BarGaugePanel {
  constructor(private page: Page) {}

  private elements = {
    barGaugeValues: (panelName: string) =>
      this.page.locator(
        `//section[contains(@data-testid, "${panelName}")]//div[contains(@data-testid, "Bar gauge value")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.barGaugeValues(panelName).first().waitFor({ state: 'visible' });

    const countOfBarGaugeElements = await this.elements.barGaugeValues(panelName).count();
    expect.soft(countOfBarGaugeElements, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfBarGaugeElements; i++) {
      const barGaugeValue = parseFloat(
        <string>await this.elements.barGaugeValues(panelName).nth(i).textContent(),
      );

      expect.soft(barGaugeValue, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
